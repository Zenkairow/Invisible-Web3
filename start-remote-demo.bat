@echo off
color 0a

:: Force the script to run in the correct project directory regardless of where this .bat file is placed
cd /d "C:\Users\ayush\OneDrive\Desktop\web_3"

echo Starting Invisible Web3 Node Orchestrator...
node demo.js
pause
