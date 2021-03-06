#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var url = require('url');
var sys = require('sys');
//var optparse = require('optparse');

var SUPPORTED_METHODS = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE'];

//var config = require('../config.json');
var config = {	
	"listenPort": process.env.OPENSHIFT_INTERNAL_PORT || 8080,
	"listenIP": process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
	"filterLists": ["easylist.txt"],
	"quiet": false
	}
var whitelist, blacklist, spoofingRules;

var resetRules = function(){
  whitelist = null;
  blacklist = null;
  spoofingRules = {};
};

var log = function(ip, code, method, url, message){
  if (config.quiet) { return; }
  if (message) {
    message = "=> " + message;
  }
  console.log([ip, code, method, url, message].join(" "));
};

var killResponse = function(req, res, code, reason) {
  log(res.connection.remoteAddress, code, req.method, req.url, reason);
  //res.writeHead(code);
	
	
	var ad = "My <img src=\"http://amazingports.com/img/logo.png\"/>lAd";
	res.writeHead(200);
	var request = require('request');
	//http.createServer(function (req, res) {
	  	console.log("fetching ad-----------");
	request.get('http://amazingports.com/img/logo.png').pipe(res);
	//res.write('<script type="text/javascript">var ados = ados || {};ados.run = ados.run || [];ados.run.push(function() {ados_addInlinePlacement(7522, 50118, 5).setClickUrl("-optional-click-macro-").loadInline();});</script><script type="text/javascript" src="http://static.adzerk.net/ados.js"></script>')
	//res.write(ad);
	//log(res.connection.remoteAddress, code, req.method, req.url, "piped------------");
	
	
	   /* var x = request('http://amazingports.com/img/logo.png', function(err, resp,body){
		res.write(body);
		*/
		//res.end();
	  
//	});
//	    req.pipe(x)
//	    x.pipe(res);

	

	
	
	//})
	//res.write(ad);
};

var requestHandler = function(cReq, cRes) {
  if (!cReq.url.match(whitelist) && cReq.url.match(blacklist)) {
    killResponse(cReq, cRes, 403, 'Blacklisted');
    return;
  }

  if (SUPPORTED_METHODS.indexOf(cReq.method) < 0) {
    killResponse(cReq, cRes, 501, 'Unsupported');
    return;
  }

  var reqUrl = url.parse(cReq.url);

  var headers = cReq.headers;

  Object.keys(spoofingRules).forEach(function(name){
    spoofingRules[name].forEach(function(r){
      if (cReq.url.match(r[0])) {
        headers[name] = r[1];
      }
    });
  });
  delete headers['proxy-connection'];

  var path = reqUrl.pathname + (reqUrl.search || '');
  var pReq = http.request({
    port: reqUrl.port || 80,
    host: reqUrl.hostname,
    method: cReq.method,
    path: path,
    headers: headers
  });

  pReq.on('error', function(err){
    killResponse(cReq, cRes, 500, err);
  });

  cRes.on('close', function(err) {
    this.terminated = true;
  });

  pReq.on('response', function(pRes){
    var ip = cReq.connection.remoteAddress;
    log(ip, pRes.statusCode, cReq.method, cReq.url, pRes.headers.location);
	//console.log("============= getting page ---------"+cReq.url+"============="+pRes.headers.location);
	var data = "";
	pRes.on('data', function(chunk){
      if (!cRes.terminated) {
		//data +=chunk;
        cRes.write(chunk, 'binary');
      }
    });
    pRes.on('end', function(){
		//console.log(data);
		//cRes.write(data);
      	if (!cRes.terminated) {
        	cRes.end();
      	}
    });
    cRes.writeHead(pRes.statusCode, pRes.headers);
  });
  cReq.on('data', function(chunk){
    pReq.write(chunk, 'binary');
  });
  cReq.on('end', function(){
    pReq.end();
  });
};

var regexpEscape = function(text){
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

var regexpFromLine = function(line){
  return regexpEscape(line).
         replace(/\\\*/, '.*'). // * => .*
         replace(/\\\^|\\\|\\\||\\\$.*/g, ''); // ignore ^ and || and $anything
};

var addSpoofingRule = function(name, line){
  if (!spoofingRules[name]) {
    spoofingRules[name] = [];
  }
  spoofingRules[name].push(line.split(/\|/).slice(1));
};

var parseFilterList = function(path){
  var lines = fs.readFileSync(path, 'utf-8').trim().split(/\n+/);
  var blEntries = [];
  var wlEntries = [];

  lines.forEach(function(line){
    if (line.match(/^!ref\|/)) {
      addSpoofingRule('referer', line);
    } else if (line.match(/^!ua\|/)) {
      addSpoofingRule('user_agent', line);
    } else if (!line.match(/^[!\[]|#/)) { // ignore comments, DOM rules and whitelisting
      if (line.match(/^@@/)) {
        wlEntries.push(regexpFromLine(line.slice(2)));
      } else {
        blEntries.push(regexpFromLine(line));
      }
    }
  });

  var append = function(list, entries){
    if (entries.length === 0) {
      return list;
    } else {
      return ((list === null) ? '' : list + '|') + entries.join('|');
    }
  };

  blacklist = append(blacklist, blEntries);
  whitelist = append(whitelist, wlEntries);

  if (!config.quiet) { console.log('Lo	aded ' + path); }
};

var loadFilterLists = function(){
  resetRules();
  config.filterLists.forEach(function(list){
    parseFilterList(list);
  });
};

/*var switches = [
  ['-f', '--filter-list FILE', 'Use filter list file'],
  ['-h', '--help', 'Show this help'],
  ['-p', '--port NUMBER', 'Listen on specified port (default ' + config.listenPort + ')'],
  ['-q', '--quiet', 'Disable logging to stdout']
];
*/
//var parser = new optparse.OptionParser(switches);
//parser.banner = 'Usage: node adproxy.js [options]';

//parser.on('port', function(k, v){ config.listenPort = v; });
//parser.on('filter-list', function(k, v){ config.filterLists.push(v); });
//parser.on('help', function(){
//  sys.puts(parser.toString());
//  process.exit();
//});
//parser.on('quiet', function(){ config.quiet = true; });
//parser.parse(process.argv);

loadFilterLists();
process.on('SIGUSR1', loadFilterLists);

var server = http.createServer();
server.listen(process.env.OPENSHIFT_NODEJS_PORT || 8080);
server.on('request', requestHandler);
//server.listen(config.listenPort);
