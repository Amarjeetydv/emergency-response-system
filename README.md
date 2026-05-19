# Emergency Response Coordination System (ERCS)

A comprehensive full-stack application designed to coordinate emergency response operations efficiently. This system enables citizens to report emergencies, dispatches them to responders, and provides administrators with tools to manage the entire coordination process.

## 🎯 Features

### For Citizens
- **Emergency Reporting**: Report emergencies with location, description, and media
- **Real-time Status Updates**: Track the status of your emergency request
- **Multiple Emergency Types**: Support for various emergency categories
- **Location-based Services**: Map integration for accurate emergency location
 

### For Emergency Responders
- **Emergency Dashboard**: View active and incoming emergency requests
- **Assignment Management**: Accept and manage assigned emergencies
- **Real-time Communication**: Socket.io powered messaging system
- **Status Tracking**: Update emergency status through the lifecycle
- **Performance Metrics**: Track response times and completion rates

### For Administrators
- **System Management**: Manage users, responders, and emergency categories
- **Analytics Dashboard**: View system-wide metrics and statistics
- **User Management**: Create, edit, and manage system users
- **Escalation Management**: Automatic escalation of critical emergencies
- **Audit Logs**: Track all system activities and changes

## 🛠️ Tech Stack

Note: Some integrations (ImageKit) are optional — the code contains guarded support for them and they are only active when corresponding environment variables are set.

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Database**: MySQL 8.x
- **Real-time Communication**: Socket.io 4.x
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer (ImageKit optional)
- **Task Scheduling**: node-cron
- **Caching**: (none by default)

### Frontend
- **Framework**: Angular 20.x
- **Language**: TypeScript 5.x
 - **UI Components**: Custom SCSS components (no Angular Material)
- **Real-time Communication**: Socket.io Client
 - **Authentication**: JWT (JSON Web Tokens)
- **Mapping**: Leaflet.js with heat map visualization
- **Styling**: SCSS
- **HTTP Client**: Angular HttpClient

### Infrastructure
- **Container**: Node.js environment with Express server
- **Process Manager**: Nodemon (development)
- **CORS**: Configured for cross-origin requests
- **API Type**: RESTful with Socket.io real-time features

## 📁 Project Structure

```
emergency-response-coordination-system/
├── backend/                          # Node.js/Express backend
│   ├── server.js                    # Main server entry point
│   ├── package.json                 # Backend dependencies
│   ├── table.sql                    # Database schema
│   ├── config/
│   │   └── db.js                    # Database configuration
│   ├── controllers/                 # Business logic
│   │   ├── authController.js        # Authentication logic
│   │   ├── emergencyController.js   # Emergency management
│   │   └── adminController.js       # Admin operations
│   ├── models/                      # Database models
│   │   ├── userModel.js
│   │   ├── emergencyModel.js
│   │   ├── messageModel.js
│   │   └── logModel.js
│   ├── routes/                      # API endpoints
│   │   ├── authRoutes.js
│   │   ├── emergencyRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/                  # Express middleware
│   │   └── authMiddleware.js        # JWT authentication
│   └── migrations/                  # Database migrations
│       └── emergency_status_update.sql
│
└── frontend/                         # Angular frontend
    ├── package.json                 # Frontend dependencies
    ├── angular.json                 # Angular configuration
    ├── tsconfig.json                # TypeScript configuration
    ├── src/
    │   ├── main.ts                  # Application entry point
    │   ├── index.html               # Main HTML file
    │   ├── styles.scss              # Global styles
    │   └── app/
    │       ├── app.ts               # Root component
    │       ├── app.routes.ts        # Route configuration
    │       ├── app.config.ts        # App configuration
    │       ├── auth.service.ts      # Authentication service
    │       ├── auth.guard.ts        # Route guard
    │       ├── role.guard.ts        # Role-based access control
    │       ├── socket.service.ts    # Real-time communication
    │       ├── emergency.service.ts # Emergency management service
    │       ├── user.service.ts      # User management service
    │       ├── components/          # Page components
    │       │   ├── login.component
    │       │   ├── register.component
    │       │   ├── dashboard.component
    │       │   └── emergency-request.component
    │       ├── dashboard/           # Dashboard panels
    │       │   ├── admin-panel/
    │       │   ├── citizen-panel/
    │       │   └── responder-panel/
    │       └── environments/        # Environment configurations
    └── public/                      # Static assets
        └── bg/                      # Background images
```

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **MySQL** (v8.0 or higher)
 
- **Angular CLI** (v20.0.0) - `npm install -g @angular/cli`

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd emergency-response-coordination-system
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

### 3. Database Setup

Create a MySQL database:

```sql
CREATE DATABASE emergency_response_system;
```

Import the schema:

```bash
mysql -u root -p emergency_response_system < table.sql
```

Apply migrations:

```bash
mysql -u root -p emergency_response_system < migrations/emergency_status_update.sql
```

### 4. Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=emergency_response_system
DB_PORT=3306

 

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGINS=http://localhost:4200,http://localhost:5000
FRONTEND_URL=http://localhost:4200

# ImageKit Configuration (optional)
# IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
# IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
# IMAGEKIT_URL_ENDPOINT=your_imagekit_url_endpoint

 
```

### 5. Frontend Setup

Navigate to the frontend directory:

```bash
cd ../frontend
```

Install dependencies:

```bash
npm install
```

Create an environment configuration file `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000'
};
```

## 🏃 Running the Application

### Start Backend Server

```bash
cd backend
npm start        # Production mode
npm run dev      # Development mode with hot reload
```

The backend server will run on `http://localhost:5000`

### Start Frontend Server

In a new terminal:

```bash
cd frontend
npm start
```

The frontend application will run on `http://localhost:4200`

 

## 🔌 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Create a new user (returns token + user)
- `POST /login` - Authenticate and receive JWT + user info
- `GET /users` - (admin) List all users
- `PATCH /users/:id/approve` - (admin) Approve responder accounts
- `PATCH /users/:id/role` - (admin) Update a user's role
- `DELETE /users/:id` - (admin) Delete a user

### Emergency Routes (`/api/emergencies`)
- `POST /api/emergencies` - Create new emergency request (multipart/form-data, protected; citizens only)
- `GET /api/emergencies` - List emergencies (citizens see their own; responders/admins see feed)
- `POST /api/emergencies/accept-request` - Atomically accept/claim a pending request (protected)
- `PUT /api/emergencies/:id` - Update emergency status (protected)
- `GET /api/emergencies/:id/chat` - Get chat history for an emergency

### Admin Routes (`/api/admin`)
- `GET /api/admin/logs` - (admin) Retrieve recent audit logs
- `GET /api/admin/analytics` - (admin) Basic system analytics (counts, responder stats)

## 🔐 Authentication & Authorization

The system uses JWT-based authentication with role-based access control:

- **Citizen**: Can create emergency requests and view their own requests
- **Responder**: Can view assigned emergencies and update status
- **Admin**: Full system access

Guards in the frontend (`auth.guard.ts`, `role.guard.ts`) protect routes based on user roles.

## 🔄 Real-time Features

Socket.io is used for:
- Real-time emergency updates
- Live messaging between responders and admins
- Status notifications
- User presence tracking

Socket.io is used for real-time messaging and notifications.

## 📊 Database Schema

Key tables:
- `users` - System users (citizens, responders, admins)
- `emergencies` - Emergency requests
- `messages` - Communication logs
- `logs` - Audit logs for admin activities

See `table.sql` and `migrations/` for complete schema.

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -am 'Add your feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions, please create an issue in the repository or contact the development team.

## 🔧 Development Tips

- Use `npm run dev` in backend for automatic server restart on file changes
- Check backend logs in terminal for debugging
- Use Angular DevTools browser extension for frontend debugging
 

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Angular Documentation](https://angular.io/docs)
- [Socket.io Documentation](https://socket.io/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
 

---

Last Updated: May 2026
