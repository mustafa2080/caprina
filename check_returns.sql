-- SQL script to check returned orders without reason
-- Run this on the server to see the current state
SELECT id, status, return_reason, return_note, updated_at 
FROM orders 
WHERE status = 'returned' 
ORDER BY updated_at DESC 
LIMIT 20;
