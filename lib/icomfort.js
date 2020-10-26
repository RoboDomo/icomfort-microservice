// TODO:
// 1.  fix these hard coded values:
//     *  get homeID from valid source
//     *  get lccid from valid source

// ONE request.agent() per instance.

const TIMEOUT = 15000;
const superagent = require("superagent");
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36";

const EventEmitter = require("events"),
  debug = require("debug")("iComfort");

const LCCID=process.env.LENNOX_LCCID,
      HOMEID=process.env.LENNOX_HOMEID,
      LENNOX_HOST="https://www.lennoxicomfort.com",
      DASHBOARD=`${LENNOX_HOST}/Dashboard`;

const log_time = () => {
  const d = new Date(),
    seconds = d.getSeconds(),
    time = d.toLocaleTimeString();
  return time; // .replace(' ', ((seconds < 9) ? ("0" + seconds) : seconds));
};

class iComfort extends EventEmitter {
  constructor(zone, username, password) {
    super();
    this.zone = zone;
    this.host = `zone${this.zone}`;
    this.username = username;
    this.password = password;
    this.connected = false;
    this.pending = [];
    console.log("log_time", log_time());
  }

  async get(uri) {
    return await this.request
      .get(`${uri}&_=${Date.now()}`)
      .timeout(TIMEOUT)
      .set("User-Agent", userAgent);
  }

  async login() {
    this.request = superagent.agent();
    this.connected = false;

    try {
      debug("Get login screen...");
      const uri = `${LENNOX_HOST}/account/login`;
      const html = await this.request //
        .get(uri) //
        .timeout(TIMEOUT)
        .set("User-Agent", userAgent);

      const rv = html.text.indexOf("__RequestVerificationToken"),
        vv = html.text.substr(rv).indexOf('value="'),
        ve = html.text.substr(rv + vv + 7).indexOf('"'),
        key = html.text.substr(rv + vv + 7, ve);

      this.requestVerificationToken = key;
      // console.log(this.requestVerificationToken);

      debug(this.host, "posting credentials");
      const submit = `${LENNOX_HOST}/Account/Login`;
      const res = await this.request
        .post(submit)
        .timeout(TIMEOUT)
        .field("__RequestVerificationToken", this.requestVerificationToken)
        .field("EmailAddress", this.username)
        .field("Password", this.password)
        .set("User-Agent", userAgent);

      if (res.statusCode === 200) {
        this.emit("connect");
        this.connected = true;
        return true;
      } else {
        debug(this.host, "status", res.statusCode);
        console.log(this.host, "pollZone fail", res);
        this.connected = false;
        this.emit("connect_error", null);
        return false;
      }
    } catch (e) {
      this.logginIn = false;
      this.connected = false;
      this.emit("connect_error", e);
      return false;
    }
  }

  async pollZones() {
    try {
      const uri = `${DASHBOARD}/GetHomeZones?homeID=${HOMEID}`;
      const res = await this.get(uri); // request.get(uri).set("User-Agent", userAgent);
      return res.text;
    } catch (e) {
      debug(this.host, "pollZones exception ", e);
      this.connected = false;
      this.emit("exception", e);
      return false;
    }
  }

  async pollZone() {
    try {
      const uri = `${DASHBOARD}/RefreshLatestZoneDetailByIndex?zoneid=${this.zone}&isPolling=true&lccid=${LCCID}`;
      const res = await this.get(uri); // request.get(uri).set("User-Agent", userAgent);
      try {
        const ret = JSON.parse(res.text);
        if (ret.Code != "LCC_ONLINE") {
          console.log(this.zone, "disconnect", ret);
          // this.connected = false;
          this.emit("disconnected");
          return false;
        }
        // console.log("poll zone result ", ret);
        return ret;
      } catch (e) {
        console.log(
          this.host,
          log_time(),
          "pollZone()",
          "JSON parse error for uri",
          uri
        );
        console.log(
          this.host,
          log_time(),
          "pollZone()",
          `JSON parse error (${res.text})`
        );
        console.log(
          this.host,
          log_time(),
          "pollZone()",
          "JSON parse exception",
          e
        );
      }
    } catch (e) {
      debug(this.host, `pollZone(${this.zone}) exception `, e);
      this.connected = false;
      this.emit("exception", e);
      return false;
    }
  }

  async poll() {
    try {
      const uri = `${DASHBOARD}/HomeDetails?zoneId=0&homeId=2312820&lccId=${LCCID}&refreshZonedetail=false`;
      const res = await this.request.get(uri).set("User-Agent", userAgent);
      try {
        if (res.text.length) {
          const ret = JSON.parse(res.text).data;
          return ret;
        }
        return null;
      } catch (e) {
        console.log(
          this.host,
          log_time(),
          "poll()",
          "JSON parse error for uri",
          uri
        );
        console.log(
          this.host,
          log_time(),
          "poll()",
          `JSON parse error (${res.text})`
        );
        console.log(this.host, log_time(), "poll()", "JSON parse exception", e);
        // console.log("res", res);
        return true;
      }
    } catch (e) {
      debug(this.host, `poll exception `, e);
      this.connected = false;
      this.emit("exception", e);
      return false;
    }
  }

  async setTargetTemperature(coolTarget, heatTarget) {
    debug(
      this.host,
      "icomfort setTargetTemperature",
      this.zone,
      coolTarget,
      heatTarget
    );
    const uri = `${DASHBOARD}/ChangeSetPoint?zoneId=${this.zone}&lccId=${LCCID}&coolSetPoint=${coolTarget}&heatSetPoint=${heatTarget}&isPerfectTempOn=false&_=${Date.now()}`;
    try {
      const res = await this.request
        .get(uri)
        .timeout(TIMEOUT)
        .set("User-Agent", userAgent);
      return res;
    } catch (e) {
      console.log(
        this.host,
        log_time(),
        "setTargetTemperature()",
        this.zone,
        coolTarget,
        heatTarget,
        uri
      );
      console.log(
        this.host,
        log_time(),
        "pollZone()",
        `JSON parse error (${res.text})`
      );
      console.log(
        this.host,
        log_time(),
        "pollZone()",
        "JSON parse exception",
        e
      );
    }
  }
}

module.exports = iComfort;
