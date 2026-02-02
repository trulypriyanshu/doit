# 🚀 CarryOut - Modern Task Manager

A feature-rich task management application built with React, featuring recurring tasks, checklists, dark mode, and local storage persistence.

![TaskFlow Screenshot](https://via.placeholder.com/800x450/6366f1/ffffff?text=TaskFlow+Preview)

## ✨ Features

✅ **Smart Task Management**
- Create, edit, delete tasks with categories & priorities
- Recurring tasks (daily, weekly, monthly, yearly)
- Checklist/subtasks with progress tracking
- Due dates with overdue highlighting

✅ **Beautiful UI/UX**
- Dark/Light mode toggle
- Responsive design (mobile & desktop)
- Animated transitions & smooth interactions
- Intuitive filtering system

✅ **Advanced Features**
- Local storage persistence
- Task statistics & progress tracking
- Recurrence pattern configuration
- Expandable task details

✅ **Organization**
- Priority levels (High/Medium/Low)
- Category tagging (Work/Personal/Meeting/Learning/Health)
- Multiple view filters (All/Today/Overdue/Recurring/Completed)

## 🖥️ Live Demo

[Live Demo Link](https://carryout.vercel.app)

## 🛠️ Tech Stack

- **Frontend:** React 18
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **ID Generation:** UUID
- **State Management:** React Hooks
- **Storage:** Local Storage API

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/task-management-app.git
   cd task-management-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server**
   ```bash
   npm start
   # or
   yarn start
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## 🚀 Deployment

### Deploy to GitHub Pages
```bash
# Install gh-pages
npm install --save-dev gh-pages

# Add to package.json
"homepage": "https://YOUR-USERNAME.github.io/task-management-app",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}

# Deploy
npm run deploy
```

### Alternative: Deploy to Vercel/Netlify
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/YOUR-USERNAME/task-management-app)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR-USERNAME/task-management-app)

## 📁 Project Structure
```
task-management-app/
├── public/
├── src/
│   ├── App.js              # Main application component
│   ├── index.js           # Entry point
│   ├── index.css          # Tailwind imports
│   └── assets/            # Images, screenshots
├── package.json
├── tailwind.config.js
└── README.md
```

## 📸 Screenshots

### Light Mode
![Light Mode](screenshots/light-mode.png)

### Dark Mode
![Dark Mode](screenshots/dark-mode.png)

### Mobile View
![Mobile](screenshots/mobile.png)

### Task Modal
![Modal](screenshots/modal.png)

## 🎯 How to Use

### Adding a Task
1. Click "New Task" button
2. Fill in title, description
3. Select category & priority
4. Set due date
5. (Optional) Enable recurrence
6. (Optional) Add checklist items
7. Click "Create Task"

### Managing Tasks
- **Complete**: Click checkbox (handles recurrence automatically)
- **Edit**: Click edit icon (pencil)
- **Delete**: Click trash icon
- **Expand**: Click task card for details

### Filtering Tasks
Use sidebar to filter by:
- All Tasks
- Due Today
- Active
- Overdue
- Recurring
- Completed

## 🔧 Customization

### Add New Categories
Edit `CATEGORY_COLORS` in `App.js`:
```javascript
const CATEGORY_COLORS = {
  shopping: 'bg-pink-100 text-pink-700 border-pink-200',
  // Add more...
};
```

### Modify Priority Levels
Update `PRIORITY_COLORS` and dropdown options.

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- [Lucide Icons](https://lucide.dev/) for beautiful icons
- [date-fns](https://date-fns.org/) for date utilities
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [React](https://reactjs.org/) for the framework

## 📞 Contact

Priyanshu Bhardwaj - [@priyanshubhardwaj](https://linkedin.com/in/priyanshubhardwaj) - iampriyanshubhardwaj@gmail.com

Project Link: [https://carryout.vercel.app](https://carryout.vercel.app)