@echo off
echo Building client-master...
cd client-master && npm install && npm run build && cd ..
echo Building client-admin...
cd client-admin && npm install && npm run build && cd ..
echo Building client-user...
cd client-user && npm install && npm run build && cd ..
echo Starting Docker...
docker-compose up --build -d
echo Done! Access:
echo   Master panel: http://localhost:3000
echo   Admin panel:  http://localhost:3001
echo   Registration: http://localhost:3002
pause
