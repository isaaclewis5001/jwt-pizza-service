const App = require('./service.js');
const Database = require('./database/database.js');
const config = require('./config.js');
const Metrics = require('./metrics.js')
const Logger = require('./logger.js')

const logger = new Logger(config);
const metrics = new Metrics(config);
const db = new Database(config.db);
const app = new App({
  database: db,
  config,
  logger,
  metrics
});

process
const port = process.argv[2] || 3000;
app.app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

app.app.on('exit', () => {
  db.close();
})


