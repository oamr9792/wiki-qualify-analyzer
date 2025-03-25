import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test server is working!' });
});

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
}); 