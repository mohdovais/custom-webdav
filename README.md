```bash
node --watch server.ts  
```

```bash
curl -X GET http://localhost:3000/deal/123/123

curl -X PROPFIND http://localhost:3000/deal/123/123 -H "Depth: 1"
```