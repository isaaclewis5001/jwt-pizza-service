const App = require('./service.js');
const Database = require('./database/database.js');
const config = require('./config.js');

const db = new Database(config.db)

const app = new App({
  database: db,
  config
});

process
const port = process.argv[2] || 3000;
app.app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

db.close();


