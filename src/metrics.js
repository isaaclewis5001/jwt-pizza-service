const os = require('os');
const config = require('./config');


function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function safeDiv(x, y) {
  if (y == 0) {
    return 0;
  }
  return x / y;
}

class Metrics {
  constructor() {
    this.totalRequests = {
      "post": 0,
      "get": 0,
      "put": 0,
      "delete": 0,
      "other": 0,
    };

    this.activeUsers = 0;
    this.authSuccesses = 0;
    this.authFailures = 0;

    this.pizzasGood = 0;
    this.pizzasFailed = 0;
    this.revenue = 0;

    this.totalLatency = 0;
    this.responseCount = 0

    this.totalFactoryLatency = 0;
    this.factoryRequestCount = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {

      this.sendMetricToGrafana('system_load', 'cpu', 'percent', getCpuUsagePercentage());
      this.sendMetricToGrafana('system_load', 'memory', 'percent', getMemoryUsagePercentage());

      this.sendMetricToGrafana('authentications', 'success', 'total', this.authSuccesses);
      this.sendMetricToGrafana('authentications', 'failed', 'total', this.authFailures);

      this.sendMetricToGrafana('active_users', 'count', 'total', this.activeUsers);

      this.sendMetricToGrafana('revenue', 'all', 'total', this.revenue);

      this.sendMetricToGrafana('pizzas_sold', 'success', 'total', this.pizzasGood);
      this.sendMetricToGrafana('pizzas_sold', 'failed', 'total', this.pizzasFailed);

      this.sendMetricToGrafana('latency', 'service', 'avg', safeDiv(this.totalLatency, this.responseCount));
      this.sendMetricToGrafana('latency', 'factory', 'avg', safeDiv(this.totalFactoryLatency, this.factoryRequestCount));

      for (let method in this.totalRequests) {
        this.sendMetricToGrafana('request', method, 'total', this.totalRequests[method]);
      }
    }, 10000);
    timer.unref();
  }

  incrementRequests(kind) {
    const kindLower = kind.toLowerCase();
    const oldReq = this.totalRequests[kindLower];
    if (oldReq !== undefined) {
      this.totalRequests[kindLower] = oldReq + 1;
    }
    else {
      this.totalRequests['other'] += 1
    }
  }


  reportSale(pizzas, revenue, success) {
    if (success) {
      this.pizzasGood += pizzas;
      this.revenue += revenue;
    }
    else {
      this.pizzasFailed += pizzas;
    }
  }

  reportLogin() {
    this.activeUsers++;
  }

  reportLogout() {
    this.activeUsers--;
  }

  reportAuth(success) {
    if (success) {
      this.authSuccesses++;
    }
    else {
      this.authFailures++;
    }
  }

  reportServiceLatency(time) {
    this.totalLatency += time;
    this.responseCount++;
  }

  reportFactoryLatency(time) {
    this.totalFactoryLatency += time;
    this.factoryRequestCount++;
  }

  sendMetricToGrafana(metricPrefix, tag, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.grafana.source},tag=${tag} ${metricName}=${metricValue}`;

    fetch(`${config.grafana.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.grafana.userId}:${config.grafana.apiKey}` },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
