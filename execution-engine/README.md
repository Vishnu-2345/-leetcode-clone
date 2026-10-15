# Execution Engine

Docker-based code execution service for running and testing user submissions.

## Features

- Secure sandboxed execution using Docker containers
- Support for multiple languages (JavaScript, Python, Java, C++)
- Resource limits (CPU, memory, execution time)
- Network isolation for security
- Async job processing with Bull queue
- Automatic test case validation

## Prerequisites

- Node.js 18+
- Docker Engine
- Redis 7+
- PostgreSQL 15+ (for storing results)

## Installation

```bash
npm install
```

## Docker Images Required

The execution engine uses official Docker images:

```bash
docker pull node:18-alpine
docker pull python:3.11-alpine
docker pull openjdk:17-alpine
docker pull gcc:latest
```

## Environment Variables

```env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://leetcode_user:leetcode_password@localhost:5432/leetcode_db
MAX_EXECUTION_TIME=5000
MAX_MEMORY_MB=256
```

## Development

```bash
npm run dev
```

## How It Works

1. **Job Received**: Submission job received from Bull queue
2. **Create Container**: Docker container created with resource limits
3. **Execute Code**: User code runs against test cases
4. **Collect Results**: Output, runtime, and memory usage collected
5. **Update Database**: Results stored in PostgreSQL
6. **Clean Up**: Container stopped and removed

## Security Features

- **Sandboxing**: Each execution runs in isolated Docker container
- **Resource Limits**: CPU, memory, and time restrictions
- **Network Disabled**: No internet access from containers
- **Read-only Filesystem**: Prevents file system modifications
- **Timeout Protection**: Kills long-running processes

## Supported Languages

### JavaScript (Node.js)
```javascript
function solution(input) {
  // Your code here
  return result;
}
```

### Python
```python
def solution(input):
    # Your code here
    return result
```

### Java
```java
class Solution {
    public String solution(String input) {
        // Your code here
        return result;
    }
}
```

### C++
```cpp
#include <iostream>
#include <string>

std::string solution(std::string input) {
    // Your code here
    return result;
}
```

## Execution Flow

```
Submission Queue
       ↓
Create Docker Container
       ↓
Write Code to Container
       ↓
Execute with Timeout
       ↓
Collect Output
       ↓
Compare with Expected
       ↓
Store Results
       ↓
Update Stats
       ↓
Clean Up Container
```

## Status Types

- **Accepted** - All test cases passed
- **Wrong Answer** - Output doesn't match expected
- **Runtime Error** - Code crashed during execution
- **Time Limit Exceeded** - Execution took too long
- **Memory Limit Exceeded** - Used too much memory
- **Compile Error** - Code failed to compile

## Monitoring

Check execution engine logs:
```bash
docker-compose logs -f execution-engine
```
