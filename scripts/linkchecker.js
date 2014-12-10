#!/usr/bin/env node

/******************************************************************************
 * Copyright (c) 2014, AllSeen Alliance. All rights reserved.
 *
 *    Permission to use, copy, modify, and/or distribute this software for any
 *    purpose with or without fee is hereby granted, provided that the above
 *    copyright notice and this permission notice appear in all copies.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *    WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *    MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 *    ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *    WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 *    ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 *    OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 ******************************************************************************/
var fs = require('fs');
var path = require('path');
var htmlparser = require("htmlparser2");
var url = require("url");

function recursiveFiles(file, callback) {
	fs.stat(file, function(err, stat) {
		if (err) {
			callback(err);
		} else {
			if (stat.isFile()) {
				callback(null, [file])
			} else if (stat.isDirectory()) {
				fs.readdir(file, function(err, files) {
					var toScan = files.length;
					var gathered = [];
					if(0 == toScan) {
						callback(null, []);
					} else {						
						for (var i = files.length - 1; i >= 0; i--) {
							recursiveFiles(path.join(file, files[i]), function(err, found) {
								if(err) {
									callback(err);
								} else {
									gathered = gathered.concat(found);
									if(0 == --toScan) {
										callback(null, gathered);
									}
								}
							});
						}
					}
				});
			} else {
				callback("Unkown file type '" + file + "'");
			}
		}
	});
}

function check(root, start) {
	process.chdir(root);
	recursiveFiles('.', function(err, allFiles) {
		var fileStatus = {};
		var notFound = {};
		var visiting = 0;

		for (var i = allFiles.length - 1; i >= 0; i--) {
			fileStatus["/" + allFiles[i]] = {visited: false, used:false};
		};

		var visit, done;

		emit404 = function(file, from) {
			notFound[file] = notFound[from] || []
			notFound[file].push(from);
		}

		visit = function(file, from) {
			if(!fileStatus[file]) {
				var indexedFile = path.normalize(file + "/index");
				if(!fileStatus[indexedFile]) {
					emit404(file,from);
					return;
				} else {
					file = indexedFile;
				}
			}

			if(fileStatus[file].visited) {
				return;
			}

			++visiting
			fileStatus[file].visited = true;
			fileStatus[file].used = true;

			fs.readFile("." + file, 'utf8', function (err,data) {
				if (err) {
					console.error(file + " " + err);
				} else {
					var parser = new htmlparser.Parser({
						onopentag: function(name, attribs){
							if(("a" == name) && (attribs["href"])){
								var href = url.parse(attribs["href"]);
								if((!href.hostname) && (href.pathname)) {
									newFile = path.resolve(file, href.pathname);
									visit(newFile, file);
								}
							}
							if("img" == name) {
								var src = url.parse(attribs["src"]);
								if(!src.hostname) {
									var img = path.resolve(file, src.pathname);
									if(fileStatus[img]) {
										fileStatus[img].used = true;
									} else {										
										emit404(img, file);
									}
								}
							}
						}
					});

					parser.write(data);
					parser.end();
				}

				if(0 == --visiting) {
					done();
				}
			});
		}

		done = function() {
			console.log("Done");
			if(0 < Object.keys(notFound).length) {
				console.error("Not Found:\n==========");
				for (var link in notFound) {
					console.error(" - " + link + " referenced by: " + notFound[link]);
				};
			}

			var notUsed = [];
			for(var file in fileStatus) {
				if(!fileStatus[file].used) {
					notUsed.push(file);
				}
			}
			if(0 < notUsed.length) {
				console.error("Not Used:\n=========");
				for (var i = notUsed.length - 1; i >= 0; i--) {
					console.error(" - " + notUsed[i]);
				};
			}
		};

		if(! fs.existsSync("."+start)) {
			console.error("Root " + start + " does not exists");
		}
		visit(start, "<initialization>");
	});
}


check('out/public', '/developers/')