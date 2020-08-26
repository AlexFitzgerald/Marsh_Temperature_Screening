var http = require('http');
var url = require('url');
const i2c = require('i2c-bus');
const Gpio = require('pigpio').Gpio;
const trigger = new Gpio(23, { mode: Gpio.OUTPUT });
const echo = new Gpio(24, { mode: Gpio.INPUT, alert: true });
var macaddress = require('macaddress');
var maddr;
macaddress.one(function (err, mac) { maddr = mac; }); // Get MAC Address

trigger.digitalWrite(0); // Make sure trigger is low

var ob1 = 0
var amb = 0
var dist = 0
temps = {};

var MLX90614 = function (addr = 0x5A) {

    // MLX90614 Default I2C Address //
    if (addr % 2 == 0 && addr <= 0xFF) {
        this.MLX_I2CADDR = addr;
        this.i2cBus = i2c.openSync(1);
    }
    else {
        err = "Bad i2c device address"
        console.error(err);
    }

}

MLX90614.prototype.register = {
    // MLX90614 RAM and EEPROM Addresses //
    'DEVICE_ID': 0xd0,
    'RESET': 0xe0,
    'CTRL_MEAS': 0xf4,
    'ADC_OUT_MSB': 0xf6,
    'ADC_OUT_LSB': 0xf7,
    'ADC_OUT_XLSB': 0xf8,

    'RAW_IR1': 0x04,
    'RAW_IR2': 0x05,
    'TA': 0x06,
    'TOBJ1': 0x07,
    'TOBJ2': 0x08,

    'TOMAX': 0x20,
    'TOMIN': 0x21,
    'PWMCTRL': 0x22,
    'TARANGE': 0x23,
    'KE': 0x24,
    'CONFIG': 0x25,
    'ADDRESS': 0x2E,
    'KE2': 0x2F,
    'ID0': 0x3C,
    'ID1': 0x3D,
    'ID2': 0x3E,
    'ID3': 0x3F,

    'REG_SLEEP': 0xFF
}


MLX90614.prototype.readAmbient = function () {
    this.i2cBus.readWord(this.MLX_I2CADDR, this.register.TA, function (err, data) {
        if (err) {
            console.error(err);
        }
        else {
            amb = data * 0.02;
            amb -= 273.15;
        }
    });
}



MLX90614.prototype.readObject = function () {
    this.i2cBus.readWord(this.MLX_I2CADDR, this.register.TOBJ1, function (err, data) {
        if (err) {
            console.error(err);
        } else {
            ob1 = data * 0.02;
            ob1 -= 273.15;
        }
    });
}

var sensor = new MLX90614();




const readDistance = () => {
    // The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
    const MICROSECDONDS_PER_CM = 1e6 / 34321;


    trigger.trigger(10, 1);


    let startTick;

    echo.on('alert', (level, tick) => {
        if (level == 1) {
            startTick = tick;
        } else {
            const endTick = tick;
            const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
            dist = diff / 2 / MICROSECDONDS_PER_CM;
        }
    });
};



function getTemp() {
    temps = {};


    sensor.readObject();
    sensor.readAmbient();
    readDistance();



}

//create server for write access
http.createServer(function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html',
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    });
    var query = url.parse(req.url, true).query;
    getTemp();

    temps['ob1'] = parseFloat(ob1);
    temps['amb'] = parseFloat(amb);
    temps['dist'] = parseFloat(dist);
    temps['mac'] = maddr;

    console.log('Ambient --- ' + amb);
    console.log('Object --- ' + ob1);
    console.log('Distnace ---  ' + dist);
    console.log('Mac ---  ' + maddr);

    res.end(JSON.stringify(temps));
}).listen(8080);
