// process.env.DEBUG = "IComfortHost,HostBase,iComfort";
process.env.DEBUG = "IComfortHost,iComfort";
process.title = process.env.TITLE || "icomfort-microservice";

const POLL_TIME = 5 * 1000; // 3 seconds

const HostBase = require("microservice-core/HostBase"),
  iComfort = require("./lib/icomfort"),
  debug = require("debug")("IComfortHost");

const topicRoot = process.env.TOPIC_ROOT || "icomfort",
  mqttHost = process.env.MQTT_HOST || "mqtt://ha";

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const log_time = () => {
  const d = new Date(),
    seconds = d.getSeconds(),
    time = d.toLocaleTimeString();
  return time; // .replace(' ', ((seconds < 9) ? ("0" + seconds) : seconds));
};

class IComfortHost extends HostBase {
  constructor(zone) {
    super(mqttHost, `${topicRoot}/zone${zone}`);
    this.zone = zone;
    this.host = `zone${zone}`;
    this.pending = [];
    // this.state = {};
    this.poll();
  }

  async poll() {
    const zone = this.zone;

    let data, zoneDetail;

    const credentials = {
        username: process.env.LENNOX_USER,
        password: process.env.LENNOX_PASSWORD,
      },
      auth = {
        username: encodeURI(credentials.username),
        password: encodeURI(credentials.password),
      };

    let connected = false;
    for (;;) {
      debug(this.host, "new iComfort");
      this.icomfort = new iComfort(
        this.zone,
        credentials.username,
        credentials.password
      );
      this.icomfort.on("connect", () => {
        debug(this.host, "iComfort connected!");
        connected = true;
      });

      this.icomfort.on("disconnect", () => {
        console.log(this.host, "DISCONNECTED!");
        connected = false;
      });

      this.icomfort.on("connect_error", (e) => {
        console.log(this.host, "iComfort connect error!", e);
      });

      this.icomfort.on("exception", async (e) => {
        console.log(this.host, "Exception", e);
      });

      debug("    ", this.host, "logging in");
      if (!(await this.icomfort.login())) {
        debug(this.host, "login failed");
        continue;
      }
      debug("    ", this.host, "poll()");
      if (!(await this.icomfort.poll())) {
        debug(this.host, "login/poll() failed");
        // continue;
      }
      debug("    ", this.host, "pollZones()");
      if (!(await this.icomfort.pollZones())) {
        debug(this.host, "login/pollZones() failed");
        continue;
      }

      debug("    ", this.host, "loop");
      while (connected) {
        for (;;) {
          const cmd = this.pending.pop();
          if (!cmd) {
            break;
          }

          try {
            if (!this.exec(cmd.command, cmd.val)) {
              this.pending.push(cmd);
              break;
            }
          } catch (e) {
            console.log("exec", e);
          }
        }

        try {
          debug(this.host, log_time(), "polling for zone ", zone);
          const result = await this.icomfort.pollZone();
          if (result !== false) {
            data = result.data;
            zoneDetail = result.data.zoneDetail;
            zoneDetail.timestamp = data.timestamp = Date.now();
            debug(this.host, "zoneDetail valid", zone);
            if (zoneDetail) {
              for (const detail of Object.keys(zoneDetail)) {
                const newState = {};
                switch (detail) {
                  case "AmbientTemperature":
                  case "CoolSetPoint":
                  case "HeatSetPoint":
                  case "SingleSetPoint":
                    newState[detail] = Number(zoneDetail[detail].Value);
                    break;

                  default:
                    newState[detail] = zoneDetail[detail];
                    break;
                }
                this.state = newState;
              }
              this.state = { data: data };
            }
          } else {
            debug("pollZone", zone, "false");
            connected = false;
            break;
          }
        } catch (e) {
          console.log("poll() exception", "data", data);
          console.log("poll() exception", "zoneDetail", zoneDetail);
          console.log("poll() exception", e);
          connected = false;
          break;
        }
        await sleep(POLL_TIME);
      }
    }
  }

  async execute(command, value) {
    switch (command) {
      case "setpoint":
        const parts = value.split(":");
        return await this.icomfort.setTargetTemperature(
          Number(parts[0]),
          Number(parts[1])
        );
      case "mode":
        return await this.icomfort.setMode(value);
      default:
        console.log(`Unknown command (${command}) value(${value})`);
        break;
    }
  }

  async command(topic, cmd) {
    console.log("\n\n");
    debug(this.host, log_time(), "command", topic, cmd);
    console.log("\n\n");

    if (!this.execute(topic, cmd)) {
      this.pending.push({ topic, cmd });
    }
  }
}

const zones = {};

const main = async () => {
  for (let zone = 0; zone < 4; zone++) {
    console.log("new iComfortHost for zone ", zone);
    zones[zone] = new IComfortHost(zone);
  }
};

main();
