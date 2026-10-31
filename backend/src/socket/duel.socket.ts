import { Server, Socket } from 'socket.io';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export interface DuelUser {
  id: string;
  username: string;
  rating: number;
}

export interface DuelPlayer {
  socketId: string;
  user: DuelUser;
  progress: number;
  totalCases: number;
  status: 'coding' | 'running' | 'accepted' | 'forfeited';
}

export interface DuelRoom {
  id: string;
  roomCode?: string;
  problem: {
    id: string;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    constraints?: string;
    examples?: any[];
    testCases?: any[];
  };
  players: Record<string, DuelPlayer>;
  status: 'waiting' | 'in_progress' | 'finished';
  winner?: string;
  startedAt?: number;
  durationSeconds: number;
}

// In-Memory state for live matches and queue
const matchmakingQueue: { socket: Socket; user: DuelUser }[] = [];
const activeRooms = new Map<string, DuelRoom>();
const socketToRoom = new Map<string, string>();

async function getRandomProblem() {
  const result = await pool.query(
    `SELECT id, title, slug, description, difficulty, constraints, examples
     FROM problems
     ORDER BY RANDOM()
     LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  const problem = result.rows[0];

  const tcResult = await pool.query(
    `SELECT id, input, expected_output, is_hidden
     FROM test_cases
     WHERE problem_id = $1 AND is_hidden = false
     ORDER BY order_index
     LIMIT 3`,
    [problem.id]
  );
  problem.testCases = tcResult.rows;
  return problem;
}

export function setupDuelSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // 1. Join Matchmaking Queue
    socket.on('arena:join_queue', async (user: DuelUser) => {
      // Remove any prior entry from queue
      const existingIdx = matchmakingQueue.findIndex((item) => item.socket.id === socket.id);
      if (existingIdx !== -1) {
        matchmakingQueue.splice(existingIdx, 1);
      }

      // Check if someone else is waiting in queue
      if (matchmakingQueue.length > 0) {
        const opponent = matchmakingQueue.shift()!;
        if (opponent.socket.id === socket.id) {
          matchmakingQueue.push({ socket, user });
          socket.emit('arena:queue_status', { inQueue: true, count: 1 });
          return;
        }

        const problem = await getRandomProblem();
        if (!problem) {
          socket.emit('arena:error', 'No problems available for duel');
          opponent.socket.emit('arena:error', 'No problems available for duel');
          return;
        }

        const roomId = `duel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const duelRoom: DuelRoom = {
          id: roomId,
          problem,
          players: {
            [socket.id]: {
              socketId: socket.id,
              user,
              progress: 0,
              totalCases: 0,
              status: 'coding',
            },
            [opponent.socket.id]: {
              socketId: opponent.socket.id,
              user: opponent.user,
              progress: 0,
              totalCases: 0,
              status: 'coding',
            },
          },
          status: 'in_progress',
          startedAt: Date.now(),
          durationSeconds: 900, // 15 mins
        };

        activeRooms.set(roomId, duelRoom);
        socketToRoom.set(socket.id, roomId);
        socketToRoom.set(opponent.socket.id, roomId);

        socket.join(roomId);
        opponent.socket.join(roomId);

        const matchPayload = {
          roomId,
          problem,
          durationSeconds: 900,
          players: Object.values(duelRoom.players),
        };

        io.to(roomId).emit('arena:match_found', matchPayload);

        // Record in DB
        try {
          await pool.query(
            `INSERT INTO duels (room_id, problem_id, player1_id, player2_id, status)
             VALUES ($1, $2, $3, $4, 'in_progress')`,
            [roomId, problem.id, user.id, opponent.user.id]
          );
        } catch (e) {
          logger.warn('Failed to insert duel into DB:', e);
        }
      } else {
        matchmakingQueue.push({ socket, user });
        socket.emit('arena:queue_status', { inQueue: true, count: 1 });
      }
    });

    // 2. Leave Queue
    socket.on('arena:leave_queue', () => {
      const idx = matchmakingQueue.findIndex((item) => item.socket.id === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
      }
      socket.emit('arena:queue_status', { inQueue: false });
    });

    // 3. Create Custom Room with Room Code
    socket.on('arena:create_custom_room', async (user: DuelUser) => {
      const problem = await getRandomProblem();
      if (!problem) {
        socket.emit('arena:error', 'No problems available');
        return;
      }

      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomId = `room_${roomCode}`;

      const duelRoom: DuelRoom = {
        id: roomId,
        roomCode,
        problem,
        players: {
          [socket.id]: {
            socketId: socket.id,
            user,
            progress: 0,
            totalCases: 0,
            status: 'coding',
          },
        },
        status: 'waiting',
        durationSeconds: 900,
      };

      activeRooms.set(roomId, duelRoom);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);

      socket.emit('arena:custom_room_created', {
        roomId,
        roomCode,
        problem,
        players: Object.values(duelRoom.players),
      });
    });

    // 4. Join Custom Room
    socket.on('arena:join_custom_room', ({ roomCode, user }: { roomCode: string; user: DuelUser }) => {
      const targetCode = roomCode.trim().toUpperCase();
      const room = Array.from(activeRooms.values()).find(
        (r) => r.roomCode === targetCode && r.status === 'waiting'
      );

      if (!room) {
        socket.emit('arena:error', 'Room not found or already in progress');
        return;
      }

      room.players[socket.id] = {
        socketId: socket.id,
        user,
        progress: 0,
        totalCases: 0,
        status: 'coding',
      };
      room.status = 'in_progress';
      room.startedAt = Date.now();

      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);

      io.to(room.id).emit('arena:match_found', {
        roomId: room.id,
        roomCode: room.roomCode,
        problem: room.problem,
        durationSeconds: 900,
        players: Object.values(room.players),
      });
    });

    // 5. Live Progress Updates (Test cases passed)
    socket.on('arena:update_progress', ({ roomId, passed, total, status }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.status !== 'in_progress') return;

      const player = room.players[socket.id];
      if (player) {
        player.progress = passed;
        player.totalCases = total;
        player.status = status;

        socket.to(roomId).emit('arena:opponent_progress', {
          socketId: socket.id,
          username: player.user.username,
          progress: passed,
          totalCases: total,
          status,
        });
      }
    });

    // 6. Match Victory (100% Accepted Submission)
    socket.on('arena:match_won', async ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.status !== 'in_progress') return;

      const winnerPlayer = room.players[socket.id];
      if (!winnerPlayer) return;

      room.status = 'finished';
      room.winner = winnerPlayer.user.username;

      // Identify loser
      const otherPlayer = Object.values(room.players).find((p) => p.socketId !== socket.id);

      // Update ratings & records in Postgres
      try {
        if (winnerPlayer.user.id) {
          await pool.query(
            `UPDATE users 
             SET rating = rating + 25, duels_won = duels_won + 1 
             WHERE id = $1`,
            [winnerPlayer.user.id]
          );
        }

        if (otherPlayer && otherPlayer.user.id) {
          await pool.query(
            `UPDATE users 
             SET rating = GREATEST(100, rating - 18), duels_lost = duels_lost + 1 
             WHERE id = $1`,
            [otherPlayer.user.id]
          );
        }

        await pool.query(
          `UPDATE duels 
           SET status = 'finished', winner_id = $1, finished_at = NOW() 
           WHERE room_id = $2`,
          [winnerPlayer.user.id, roomId]
        );
      } catch (err) {
        logger.warn('Failed to update duel stats in DB:', err);
      }

      io.to(roomId).emit('arena:match_ended', {
        winner: winnerPlayer.user.username,
        winnerId: winnerPlayer.user.id,
        ratingDelta: 25,
        reason: 'Passed all test cases! 🏆',
      });
    });

    // 7. Forfeit Match
    socket.on('arena:forfeit', async ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.status !== 'in_progress') return;

      const forfeiter = room.players[socket.id];
      const winner = Object.values(room.players).find((p) => p.socketId !== socket.id);

      room.status = 'finished';
      if (winner) room.winner = winner.user.username;

      if (winner && winner.user.id) {
        try {
          await pool.query(
            `UPDATE users SET rating = rating + 20, duels_won = duels_won + 1 WHERE id = $1`,
            [winner.user.id]
          );
          if (forfeiter?.user.id) {
            await pool.query(
              `UPDATE users SET rating = GREATEST(100, rating - 15), duels_lost = duels_lost + 1 WHERE id = $1`,
              [forfeiter.user.id]
            );
          }
        } catch (_) {}
      }

      io.to(roomId).emit('arena:match_ended', {
        winner: winner ? winner.user.username : 'Opponent',
        winnerId: winner?.user.id,
        ratingDelta: 20,
        reason: `${forfeiter?.user.username || 'Opponent'} surrendered`,
      });
    });

    // 8. Disconnect Handler
    socket.on('disconnect', () => {
      // Remove from queue
      const qIdx = matchmakingQueue.findIndex((item) => item.socket.id === socket.id);
      if (qIdx !== -1) {
        matchmakingQueue.splice(qIdx, 1);
      }

      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        const room = activeRooms.get(roomId);
        if (room && room.status === 'in_progress') {
          const disconnectedPlayer = room.players[socket.id];
          const remainingPlayer = Object.values(room.players).find((p) => p.socketId !== socket.id);

          room.status = 'finished';
          if (remainingPlayer) {
            room.winner = remainingPlayer.user.username;
          }

          io.to(roomId).emit('arena:opponent_disconnected', {
            disconnectedUser: disconnectedPlayer?.user.username || 'Opponent',
            winner: remainingPlayer?.user.username,
          });
        }
        socketToRoom.delete(socket.id);
      }
    });
  });
}

