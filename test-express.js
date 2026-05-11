const express = require('express');
const app = express();
app.get('/test/*path', (req, res) => {
  res.json(req.params);
});
app.listen(3001, () => {
  console.log('Test server running');
});
