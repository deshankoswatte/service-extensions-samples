const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Define endpoints (routes)
app.get('/', (req, res) => {
  res.send('Hello from the home endpoint!');
});

app.post('/add-custom-claim', (req, res) => {
  const response = {
    actionStatus: "SUCCESS",
    operations: [
      {
        op: "add",
        path: "/accessToken/claims/-",
        value: {
          name: "customSID",
          value: "12345"
        }
      }
    ]
  };

  res.setHeader('Content-Type', 'application/json;charset=UTF-8');
  res.status(200).json(response);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});