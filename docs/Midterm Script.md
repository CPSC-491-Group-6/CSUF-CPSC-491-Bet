<!-- ./docs/Midterm Script.md -->
<!-- This file provides a guide for the midterm presentation. -->

# Midterm Presentation

Members:
Brite Bartnek (A)
Jake Miso (B)
Lam Doan (C)
Alex Trang (D)
Linh Tran (E)

## Introducing the Project (~2:00)
(E) will give a quick overview of the project and what features are currently available such as registering users, logging in, viewing one's profile, and creating/viewing bets.

## Backend (~2:00)
(A) will demonstrate backend functionality including starting, installing necessary dependencies, initializing seeding, and resetting the database that's used for user accounts
Setup: 
1. Navigate to the backend directory
2. Run the command: npm install to install the necessary dependencies for the app to run.
3. Run cp .env.example .env, then run node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" and type the generated value into the .env file.
4. Run the command: npm run db:init to initialize the database.
5. Run the command: npm run db:seed to fill the database with initial user data.
6. Run npm start or npm run dev to start up the backend.
Expected Results: User information initialized is ready to use in the front end and demonstrates backend functionality.

## Run Unit Tests (~2:00)
(B) will run the appropriate tests and unit tests for the application, explaining what the tests are for and how it helps determine the app's functionality without needing to run it every time.

## Frontend (~2:00)
(C) will demonstrate frontend functionality including setup, logging in, and registering within the app.
Setup:
1. Navigate to the frontend directory
2. Run the command: npm install to install the necessary dependencies for the app to run
3. Run the command: npm start or npm run dev to start up the frontend.
Expected Results: 
- Logging in successfully with the correct email and password
- Wrong Email/Password is displayed with the incorrect input
- Registration is able to lead to logging in

## Create And List Bets (~2:00)
(D) will demonstrate the rest of the current functionalities within the app such as profile viewing along with bet creation, customization, joining, and viewing.
Expected Results: Bet creation is functional with user input and the created bets are able to be viewed.

## Resetting
For database resetting, navigate through a terminal to the backend (Ex cd 'project name' -> cd backend). 
Then:
- Run "npm run db:reset" for a complete reset of the database, removing all data that was previously in the database. 
- Or run "npm run db:reset:seed" to erase all previous data and immediately create default accounts for appllication use.

## Demo Accounts To Use For Demo
User 1
- Email: creator@example.com
- Password: DemoPassword123!

User 2
- Email: participant@example.com
- Password: DemoPassword123!