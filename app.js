require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const randomstring = require("randomstring");
const getIP = require('ipware')().get_ip;
const Fingerprint = require('express-fingerprint');
const mongoose = require("mongoose");
const expressip = require('express-ip');

var app = express();


app.use(expressip().getIpInfoMiddleware);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(Fingerprint({
    parameters:[
        Fingerprint.useragent,
        Fingerprint.acceptHeaders,
        Fingerprint.geoip,
      ]
    })
  )

mongoose.connect(process.env.DB_HOST, {
  useNewUrlParser: true
});

const counterSchema = mongoose.Schema({
  website: String,
  visits: Number,
  viewKey: String,
  countKey: String,
  dataCollection: Array
});

const Counter = mongoose.model("Counter", counterSchema);

    app.get("/", function(req, res) {
      var params = [
       { title: 'NoJS Visits Counter' },
      ];
      res.render("pages/index", {
        title: params[0].title,
      });
    });

    app.post("/view", function(req, res) {
      const key = req.body.viewKey;
      Counter.findOne({viewKey: key}, function(err, foundWebsite) {
        if (!err) {
          if(foundWebsite) {
            var website = foundWebsite.website;
            var visits = foundWebsite.visits;
            var dataCollection = foundWebsite.dataCollection;
            var uniques = countUniques(dataCollection);
            var params = [
             { key: key, website: website, visits: visits, dataCollection: dataCollection },
            ];
            res.render("pages/view", {
              key: params[0].key,
              website: params[0].website,
              visits: params[0].visits,
              dataCollection: params[0].dataCollection,
              uniques: uniques,
              userData: params[0].userData
            });
          } else {
            res.send("key not in the db")
          }
        } else {
          console.log(err)
        }
      });
    });

    app.post("/register", function(req, res) {
      const website = req.body.website;
      Counter.findOne({website: website}, function(err, foundWebsite) {
        setTimeout(function(){
          if (foundWebsite) {
            res.send("Website already registered");
          } else {
            createTheCounter(website, res, req);
          }
        },100);
      });
    });


    app.get("/count/:key", function(req, res) {
      const key = req.params.key;
      Counter.findOne({countKey: key}, function(err, foundWebsite) {
        if (!err) {
          if(foundWebsite) {
            const website = foundWebsite.website;
            setTimeout(function() {
              updateTheCounter(website, res, req)
            }, 200);
          } else {
            res.send("key not in the db")
          }
        } else {
          console.log(err)
        }
      });
    });


      const createTheCounter = (website, res, req) => {
        console.log("Creating the website in the db")
        const randomStringPublic = randomstring.generate(10);
        const randomStringPrivate = randomstring.generate(10);
        const fullUrl = req.protocol + '://' + req.get('host') + "/count/" + randomStringPublic;
        console.log(fullUrl);
        const newCounter = new Counter({
              website: website,
              visits: 0,
              countKey: randomStringPublic,
              viewKey: randomStringPrivate,
              dataCollection: []
            });
            newCounter.save(function(err) {
              if (!err) {
                console.log(website + " added to the db")
              } else {
                console.log(err);
              }
            })
            res.render("pages/new-counter", {
              viewKey: randomStringPrivate,
              website: website,
              fullUrl: fullUrl
            })
          }


          const updateTheCounter = (website, res, req) => {
            console.log("updating the " + website + " counter");
            Counter.findOne({website: website}, function(err, foundWebsite) {
              if (!err) {
                const website = foundWebsite.website;
                const currentVisits = foundWebsite.visits;
                const dataCollection = foundWebsite.dataCollection;
                const dateStamp = new Date();
                const fingerPrintHash = req.fingerprint.hash;
                const ipInfoCountry = req.ipInfo.country || "NaN";
                const ipInfoCity = req.ipInfo.city || "NaN";
                console.log(ipInfoCountry + " " + ipInfoCity);
                dataCollection.push({ip: getIP(req).clientIp, dateStamp: dateStamp, hash: fingerPrintHash, country: ipInfoCountry, city: ipInfoCity});
                const newVisits = currentVisits + 1;
                  Counter.updateOne({
                    website: website
                  }, {
                    $set: {"visits" : newVisits, "dataCollection" : dataCollection}
                  }, {
                    overwrite: true
                  }, function(error) {
                    if (!error) {
                      res.send(website + " updated");
                    } else {
                      res.send(error);
                    }
                  });
              } else {
                console.log(err)
              }
            });
          }

          const countUniques = (a) => {
            var counts = [];
            for(var i = 0; i <= a.length; i++) {
              if (a[i] !== undefined && !counts.includes(a[i].ip)) {
                counts.push(a[i].ip)
              }
            }
            return counts.length;
          }


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(3000, function() {
  console.log("Server started");
});

module.exports = app;
