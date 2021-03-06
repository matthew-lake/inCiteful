var express = require("express");
var app = express();
var fs = require("fs");
var request = require("request");
var os = require("os");

var key = '';
var server;

app.get('/', function(req, res) {
	var author = req.query["author"];

	if (author) {
		fs.readFile("data/" + author + ".json", "utf8" , function(err, data) {
			var callbacks = [];
			callbacks.push(end);
			callbacks.push(results);

			if (err) {
				var url = "http://academic.research.microsoft.com/json.svc/search?";

				url += "AppID=" + key;

				url += "&FullTextQuery=" + author.replace(' ', '+');
				url += "&ResultObjects=" + "author";
				url += "&StartIdx=" + "1";
				url += "&EndIdx=" + "1";

				request(url, function (error, response, body) {
					if (!error && response.statusCode == 200) {

						var json = JSON.parse(body);

						var me = json["d"]["Author"]["Result"] !== null ? json["d"]["Author"]["Result"][0] : null;

						if (me !== null) {
							fs.writeFile("data/" + author + ".json", JSON.stringify(me, null, 4));
						}
					}
				});
			} else {
				console.log("exists");

				var me = JSON.parse(data);
			}

			header("", callbacks, {"res": res, "json": me, "author": author});
		});
	} else {
		var callbacks = [];
		callbacks.push(end);
		callbacks.push(homepage);
		header("", callbacks, {"res": res});
	}
});

homepage = function(input, callbacks, args) {
	var page = input;

	page += add("<div class='search'>");
	page += add("<h4>See your research impact:</h4>");
	page += add("<form method='get'> <input type='text' name='author' placeholder='Your Name'/> <button type='submit'>Enter</button></form>");

	page += add("</div>");

	var callback = callbacks.pop();
	return callback(page, callbacks, args);
};

results = function(input, callbacks, args) {
	var json = args["json"];

	var page = input;

	page += add("<div class='results'>");

	if (json === null || json === undefined) {
		page += add("<h2>Sorry, we couldn't find you :(</h2>");
	} else {
		var name = json["FirstName"] + " " + json["MiddleName"] + " " + json["LastName"];
		var id = json["ID"];
		var affiliation = json["Affiliation"] !== null ? json["Affiliation"]["Name"] : "";
		var citeCount = json["CitationCount"];
		var pubCount = json["PublicationCount"];
		var h_index = json["HIndex"];
		var g_index = json["GIndex"];

		page += add("<h2>" + name + "<small> &mdash; " +  affiliation + "</small> </h2>");
		page += add("<div class='left'>");
		page += add("<h3>Total Citation Count: <span>" + citeCount + "</span></h3>");
		page += add("<h3>Total Publication Count: <span>" + pubCount + "</span></h3>");
		page += add("<h3>Average Citations per Publication: <span>" + (citeCount/pubCount).toFixed(1) + "</span></h3>");
		page += add("</div>");
		page += add("<div class='right'>");
		page += add("<h3>H-Index: <div class='circle'>" + h_index + "</div> <a href='https://en.wikipedia.org/wiki/H-index'>?</a></h3>");
		page += add("<h3>G-Index: <div class='circle'>" + g_index + "</div> <a href='https://en.wikipedia.org/wiki/G-index'>?</a></h3>");

		if (json["LIndex"] !== undefined) {
			page += add("<h3>L-Index: <div class='circle circleBig'>" + json["LIndex"].toFixed(1) + "</div> <a href='http://f1000research.com/articles/4-884/v1'>?</a></h3>");
			page += add("</div>");

			if (json["Publications"] !== undefined) {
				page += "<div id='chartContainer' class='chart'></div>";

				var pubs = [];
				var cites = [];

				page += add("<h2>Publications</h2>");

				page += add("<table class='sortable'>");

				page += add("<thead>");
				page += add("<tr>");
				page += add("<th>Year</th>");
				page += add("<th>Title</th>");
				page += add("<th>Citations</th>");
				page += add("</tr>");
				page += add("</thead>");

				page += add("<tbody>");
				json["Publications"].forEach(function(element, index, array) {
					if (element.Year !== 0) {
						pubs[element.Year] = pubs[element.Year] == undefined ? 1 : pubs[element.Year] + 1;
						cites[element.Year] = cites[element.Year] == undefined ? element.CitationCount : cites[element.Year] + element.CitationCount;
					}

					page += add("<tr>");
					page += add("<td>" + element.Year + "</td>");
					page += add("<td>" + element.Title + "</td>");
					page += add("<td>" + element.CitationCount + "</td>");
					page += add("</tr>");
				});

				var pubData = [];
				pubs.forEach( function(element, index, array) {
					if (element != 0) {
						pubData.push({"x": index, "y": element});
					}
				});
				page = page.replace("PUBS", JSON.stringify(pubData, null, 4));

				var citeData = [];
				cites.forEach( function(element, index, array) {
					if (element != 0) {
						citeData.push({"x": index, "y": element});
					}
				});
				page = page.replace("CITES", JSON.stringify(citeData, null, 4));

				page += add("</tbody>");
				page += add("</table>");
			}
		} else {
			page += add("</div>");

			json ["Publications"] = [];
			json["LIndex"] = 0;
			l_index(1, pubCount, id, 0, json, args["author"]);
		}
	}

	page += add("</div>");

	var callback = callbacks.pop();
	return callback(page, callbacks, args);
};

header = function(input, callbacks, args) {
	fs.readFile("static/header.html", "utf8" , function(err, data) {
		if (!err) {
			var callback = callbacks.pop();
			return callback(input + data, callbacks, args);
		}
	});
};

end = function(input, callbacks, args) {
	var page = input;
	page += add("</html>");

	var res = args["res"];
	res.send(page);
};

add = function(string) {
	return string + os.EOL;
};

fs.readFile("API key.txt", "utf8" , function(err, data) {
	key = data;

	server = app.listen(3000);
});

l_index = function(i, max, id, sum, me, author) {
	console.log(i + " / " + max);
	if (i <= max) {
		var url = "http://academic.research.microsoft.com/json.svc/search?";

		url += "AppID=" + key;
		url += "&AuthorID=" + id;

		url += "&ResultObjects=" + "publication";
		url += "&PublicationContent=" + "title,author";
		url += "&StartIdx=" + i;
		url += "&EndIdx=" + i;

		request(url, function (error, response, body) {
			var err = false;

			if (!error && response.statusCode == 200) {
				var json = JSON.parse(body);
				if (json["d"]["Publication"]["Result"] !== null) {
					var pub = json["d"]["Publication"]["Result"][0];
					var c = pub["CitationCount"];
					var a = Object.keys(pub["Author"]).length;
					var y = pub["Year"] !== 0 ? new Date().getFullYear() - pub["Year"] + 1 : 1;

					sum += c / (a * y);

					me["Publications"].push({
						"Title" : pub["Title"],
						"CitationCount" : c,
						"Year": pub["Year"]
					});
				} else {
					err = true;
				}
			} else {
				err = true;
			}

			if (err) {
				console.log("error");
				setTimeout((function() {l_index(i, max, id, sum, me, author)})(i), 300);
			} else {
				setTimeout((function() {l_index(i + 1, max, id, sum, me, author)})(i), 300);
			}
		});
	} else {
		var l = Math.log(sum * 3) + 1;
		console.log(l);
		me["LIndex"] = l;

		fs.writeFile("data/" + author + ".json", JSON.stringify(me, null, 4));
	}
};

app.use('/static', express.static('static'));