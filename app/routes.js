var mysql = require('mysql');
var async = require('async');
var dbconfig = require('../config/database');
var formidable = require('formidable');
var fs = require('fs');
var path = require('path');
var connection = mysql.createConnection(dbconfig.connection);
connection.connect(function(error){
    if(error){
        console.log("ROUTES Couldn't connect :(    Error: " + error);
    } else {
        console.log("ROUTES Connected successfully~!");
    }    
});
// app/routes.js
module.exports = function(app, passport) {
    
	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		res.render('index.ejs'); // load the index.ejs file
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {

		// render the page and pass in any flash data if it exists
		res.render('login.ejs', { message: req.flash('loginMessage') });
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/list', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
		}),
        function(req, res) {
            if (req.body.remember) {
              req.session.cookie.maxAge = 1000 * 60 * 3;
            } else {
              req.session.cookie.expires = false;
            }
        res.redirect('/');
    });

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		// render the page and pass in any flash data if it exists
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// ===================================== DD
	// FUNCTION ============================ DDD
	// ===================================== DD

    // CALL TO LOAD LIST PAGE
    
    // LOAD LIST PAGE OFCOURSE
        function load_listPage(req,res,page){
        var series_list;
        var publisher_list;
        var book_list;
        var categories_list;
        async.waterfall([
            async.apply(get_books, req.user.id),
            get_series,
            get_publisher,
            get_categories,
        ], function (err, result) {
            if (err) {
                res.send(err);
            } else {
                categories_list = result;
                res.render('list.ejs', {
                    page_number : page,
                    username : req.user.username,
                    list : book_list.slice(page*10-10, page*10-10+10),
                    list_length : book_list.length,
                    series : series_list,
                    publishers : publisher_list,
                    categories : categories_list,
                });
            }
        });
        function get_books(user_id, callback) {
            var user_id = user_id;
            connection.query("SELECT b_id,b_name,DATE_FORMAT(b_release,'%m-%d-%Y') as b_release_date,s_id FROM books WHERE u_id = ? ORDER BY b_id DESC",[req.user.id], callback);
        }
        function get_series(books_row, books_field, callback) {
            book_list = books_row;
            connection.query("SELECT * FROM series;", callback);
        }
        function get_publisher(series_row, series_field, callback) {
            series_list = series_row;
            connection.query("SELECT * FROM publishers;", callback);
        }
        function get_categories(publisher_row, publisher_field, callback) {
            publisher_list = publisher_row;
            connection.query("SELECT * FROM categories;", callback);
        }
    }
    
	app.get('/list', isLoggedIn, function(req, res) {
        load_listPage(req,res,1)
	});

	app.get('/list/:page', isLoggedIn, function(req, res) {
        var data = parseInt(req.params["page"])
        if(typeof data==='number' && (data%1)===0) {
            load_listPage(req,res,data)
        } else {
            res.redirect('/list')
        }
	});
    
    // ADD BOOK only query on book table atm.
	app.post('/add_book', isLoggedIn, function(req, res) {
        console.log(req.body)
        var user_id = req.user.id;
        var user_name = req.user.username;
        var book_name = req.body.book_name;
        var book_release = req.body.book_release;
        var series_name, publisher_name;
        var series_method = req.body.series_method;
        var publihser_method = req.body.publisher_method;
        
        var categories = req.body.categories;
        var catseQuery = "insert into catse values "
        var series_id, alreadyAdded;
        var addCat = false;
        var newCat = false;
        if (categories != null && categories != NaN){
            addCat = true;
            if (typeof(categories) == 'string'){
                categories = [categories,]
            }
        }
        if (series_method == "choose") {
            series_name = req.body.series_name[0];
            series_id = req.body.series_name[0];
            async.waterfall([
                function(callback) {
                    connection.query("insert into books values (null,'" + book_name + "','" + book_release + "','" + user_id + "','" + series_name + "');", callback);
                },
                function(insert_row, insert_field, callback) {
                    connection.query("select c_id from catse where s_id="+series_id, callback);
                },
                function(get_cID_row, get_cID_field, callback) {
                    if (addCat) {
                        for (var i = 0; i < categories.length; i++) {
                            alreadyAdded = false;
                            for (var j = 0; j < get_cID_row.length && alreadyAdded == false; j++) {
                                if (categories[i] == get_cID_row[j].c_id){
                                    alreadyAdded = true;
                                }
                            }
                            console.log(alreadyAdded)
                            if (alreadyAdded == false){
                                catseQuery += "("+categories[i]+","+series_id+"),"
                                newCat = true
                            }
                        }
                        catseQuery = catseQuery.slice(0, -1)
                        console.log(catseQuery)
                        if (newCat)
                            connection.query(catseQuery, callback);
                        else {
                            callback(null);
                        }
                    } else {
                        callback(null);
                    }
                },
            ], function (err, result) {
                if (err) {
                    console.log(err)
                }
                res.redirect('/list')
            });
        } else {
            series_name = req.body.series_name[1];
            if (publihser_method == "choose") {
                publisher_name = req.body.publisher_name[0];
                async.waterfall([
                    function(callback) {
                        connection.query("insert into series values (null,'" + series_name + "','" + publisher_name + "');", callback);
                    },
                    function(insert_row, insert_field, callback) {
                        connection.query("select * from series where s_id = LAST_INSERT_ID();", callback);
                    },
                    function(get_sID_row, get_sID_field, callback){
                        series_id = get_sID_row[0].s_id;
                        connection.query("insert into books values (null,'" + book_name + "','" + book_release + "','" + user_id + "','" + get_sID_row[0].s_id + "');", callback);
                    },
                    function(insert_book_row, insert_book_field, callback){
                        if (addCat) {
                            for (var i = 0; i < categories.length; i++) {
                                catseQuery += "("+categories[i]+","+series_id+"),"
                            }
                            catseQuery = catseQuery.slice(0, -1)
                            console.log(catseQuery)
                            connection.query(catseQuery, callback);
                        } else {
                            callback(null);
                        }
                    },
                ], function (err, result) {
                    if (err) {
                        res.send(err)
                    }
                    res.redirect('/list')
                });
            } else if (publihser_method == "add") {
                publisher_name = req.body.publisher_name[1];
                async.waterfall([
                    function(callback) {
                        connection.query("insert into publishers values (null,'" + publisher_name + "');", callback);
                    },
                    function(add_pub_row, add_pub_field, callback) {
                        connection.query("select * from publishers where p_id = LAST_INSERT_ID();", callback);
                    },
                    function(get_pID_row, get_pID_field, callback) {
                        connection.query("insert into series values (null,'" + series_name + "','" + get_pID_row[0].p_id + "');", callback);
                    },
                    function(insert_series_row, insert_series_field, callback) {
                        connection.query("select * from series where s_id = LAST_INSERT_ID();", callback);
                    },
                    function(get_sID_row, get_sID_field, callback){
                        series_id = get_sID_row[0].s_id;
                        connection.query("insert into books values (null,'" + book_name + "','" + book_release + "','" + user_id + "','" + get_sID_row[0].s_id + "');", callback);
                    },
                    function(insert_book_row, insert_book_field, callback){
                        if (addCat) {
                            for (var i = 0; i < categories.length; i++) {
                                catseQuery += "("+categories[i]+","+series_id+"),"
                            }
                            catseQuery = catseQuery.slice(0, -1)
                            console.log(catseQuery)
                            connection.query(catseQuery, callback);
                        } else {
                            callback(null);
                        }
                    },
                ], function (err, result) {
                    if (err) {
                        res.send(err)
                    }
                    res.redirect('/list')
                });
            } else {
                res.redirect('/list')
            }
        }
	});
    
    app.post('/apply_changes/:id', isLoggedIn, function(req, res){
        console.log(req.body)
        var user_id = req.user.id;
        var user_name = req.user.username;
        var book_id = req.params["id"]
        var book_name = req.body.book_name;
        var book_release = req.body.book_release;
        var series_name, publisher_name, edit_query;
        var series_method = req.body.series_method;
        var publihser_method = req.body.publisher_method;
        var success_msg = "All changes saved !";
        var info_msg = "";
        var danger_msg = "";
        
        var categories = req.body.categories;
        var remove_cat = req.body.remove_cat;
        var removeCatQuery = "DELETE from catse WHERE "
        var catseQuery = "insert into catse values "
        var series_id, alreadyAdded;
        var addCat = false;
        var newCat = false;
        var removeCat = false;
        if (categories != null && categories != NaN){
            addCat = true;
            if (typeof(categories) == 'string'){
                categories = [categories,]
            }
        }
        if (remove_cat != null && remove_cat != NaN){
            removeCat = true;
            if (typeof(remove_cat) == 'string'){
                remove_cat = [remove_cat,]
            }
        }
        if (series_method == "choose") {
            series_name = req.body.series_name[0];
            series_id = req.body.series_name[0];
            removeCatQuery += "s_id = "+series_id+" AND c_id IN ("
            edit_query = "update books set b_name='" + req.body.book_name + "',b_release='" + req.body.book_release + "',u_id='" + req.user.id + "',s_id='" + req.body.series_name[0] + "' where b_id='" + book_id + "';";
            async.waterfall([
                function(callback) {
                    connection.query(edit_query, callback);
                },
                function(update_row, update_field, callback) {
                    if (removeCat) {
                        for (var i = 0; i < remove_cat.length; i++) {
                            removeCatQuery += (remove_cat[i] + ",")
                        }
                        removeCatQuery = removeCatQuery.slice(0, -1) + ")";
                        console.log(removeCatQuery)
                        connection.query(removeCatQuery, callback);
                    } else {
                        callback(null, null, null)
                    }
                },
                function(remove_cat_row, remove_cat_field, callback) {
                    connection.query("select c_id from catse where s_id="+series_id, callback);
                },
                function(get_cID_row, get_cID_field, callback) {
                    if (addCat) {
                        for (var i = 0; i < categories.length; i++) {
                            alreadyAdded = false;
                            for (var j = 0; j < get_cID_row.length && alreadyAdded == false; j++) {
                                if (categories[i] == get_cID_row[j].c_id){
                                    alreadyAdded = true;
                                }
                            }
                            console.log(alreadyAdded)
                            if (alreadyAdded == false){
                                catseQuery += "("+categories[i]+","+series_id+"),"
                                newCat = true
                            }
                        }
                        catseQuery = catseQuery.slice(0, -1)
                        console.log(catseQuery)
                        if (newCat)
                            connection.query(catseQuery, callback);
                        else {
                            callback(null);
                        }
                    } else {
                        callback(null);
                    }
                },
            ], function (err, result) {
                if (err) {
                    console.log(err)
                }
                load_bookPage(req, res, success_msg, info_msg, danger_msg);
            });
        } else {
            series_name = req.body.series_name[1];
            if (publihser_method == "choose") {
                publisher_name = req.body.publisher_name[0];
                async.waterfall([
                    function(callback) {
                        edit_query = "insert into series values (null,'" + series_name + "','" + publisher_name + "');";
                        connection.query(edit_query, callback);
                    },
                    function(insert_row, insert_field, callback) {
                        edit_query = "select * from series where s_id = LAST_INSERT_ID();"
                        connection.query(edit_query, callback);
                    },
                    function(get_sID_row, get_sID_field, callback){
                        series_id = get_sID_row[0].s_id
                        edit_query = "update books set b_name='" + req.body.book_name + "',b_release='" + req.body.book_release + "',u_id='" + req.user.id + "',s_id='" + get_sID_row[0].s_id + "' where b_id='" + book_id + "';";
                        connection.query(edit_query, callback);
                    },
                    function(update_row, update_field, callback) {
                        connection.query("select c_id from catse where s_id="+series_id, callback);
                    },
                    function(get_cID_row, get_cID_field, callback) {
                        if (addCat) {
                            for (var i = 0; i < categories.length; i++) {
                                alreadyAdded = false;
                                for (var j = 0; j < get_cID_row.length && alreadyAdded == false; j++) {
                                    if (categories[i] == get_cID_row[j].c_id){
                                        alreadyAdded = true;
                                    }
                                }
                                console.log(alreadyAdded)
                                if (alreadyAdded == false){
                                    catseQuery += "("+categories[i]+","+series_id+"),"
                                    newCat = true
                                }
                            }
                            catseQuery = catseQuery.slice(0, -1)
                            console.log(catseQuery)
                            if (newCat)
                                connection.query(catseQuery, callback);
                            else {
                                callback(null);
                            }
                        } else {
                            callback(null);
                        }
                    },
                ], function (err, result) {
                    if (err) {
                        console.log(err)
                    }
                    load_bookPage(req, res, success_msg, info_msg, danger_msg);
                });
            } else if (publihser_method == "add") {
                publisher_name = req.body.publisher_name[1];
                async.waterfall([
                    function(callback) {
                        edit_query = "insert into publishers values (null,'" + publisher_name + "');"
                        connection.query(edit_query, callback);
                    },
                    function(add_pub_row, add_pub_field, callback) {
                        edit_query = "select * from publishers where p_id = LAST_INSERT_ID();"
                        connection.query(edit_query, callback);
                    },
                    function(get_pID_row, get_pID_field, callback) {
                        edit_query = "insert into series values (null,'" + series_name + "','" + get_pID_row[0].p_id + "');";
                        connection.query(edit_query, callback);
                    },
                    function(insert_row, insert_field, callback) {
                        edit_query = "select * from series where s_id = LAST_INSERT_ID();"
                        connection.query(edit_query, callback);
                    },
                    function(get_sID_row, get_sID_field, callback){
                        series_id = get_sID_row[0].s_id
                        edit_query = "update books set b_name='" + req.body.book_name + "',b_release='" + req.body.book_release + "',u_id='" + req.user.id + "',s_id='" + get_sID_row[0].s_id + "' where b_id='" + book_id + "';";
                        connection.query(edit_query, callback);
                    },
                    function(update_row, update_field, callback) {
                        connection.query("select c_id from catse where s_id="+series_id, callback);
                    },
                    function(get_cID_row, get_cID_field, callback) {
                        if (addCat) {
                            for (var i = 0; i < categories.length; i++) {
                                alreadyAdded = false;
                                for (var j = 0; j < get_cID_row.length && alreadyAdded == false; j++) {
                                    if (categories[i] == get_cID_row[j].c_id){
                                        alreadyAdded = true;
                                    }
                                }
                                console.log(alreadyAdded)
                                if (alreadyAdded == false){
                                    catseQuery += "("+categories[i]+","+series_id+"),"
                                    newCat = true
                                }
                            }
                            catseQuery = catseQuery.slice(0, -1)
                            console.log(catseQuery)
                            if (newCat)
                                connection.query(catseQuery, callback);
                            else {
                                callback(null);
                            }
                        } else {
                            callback(null);
                        }
                    },
                ], function (err, result) {
                    if (err) {
                        console.log(err)
                    }
                    load_bookPage(req, res, success_msg, info_msg, danger_msg);
                });
            } else {
                res.send("hello");
            }
        }
	});
    
    // LOAD EDIT PAGE OF SPECIFIED BOOK aka shit that now fucking work
    
	app.get('/edit/:id', isLoggedIn, function(req, res) {
        var paramID = parseInt(req.params["id"])
        if(typeof paramID==='number' && (paramID%1)===0) {
            var book_info = []
            var series_id, all_series_info, all_publishers_info, all_categories_info;
            async.waterfall([
                function (callback) { //example
                    var book_id = req.params["id"];
                    connection.query("SELECT b_id,b_name,DATE_FORMAT(b_release,'%m-%d-%Y') as b_release_date,s_id,u_id FROM books WHERE b_id = ?",[book_id], callback);
                },
                async.apply(find_book, req.params["id"]),
                find_series,
                find_publisher,
                find_catagories,
                all_series,
                all_publishers,
                all_categories,
            ], function (err, result) {
                if (err) {
                    res.send(err);
                } else {
                    all_categories_info = result;
                    res.render('edit.ejs', {
                        user : req.user,
                        username : req.user.username,
                        book_info : book_info,
                        all_series_info : all_series_info,
                        all_publishers_info : all_publishers_info,
                        all_categories_info : all_categories_info,
                    });
                }
            });
            function find_book(book_id, example_row, example_field, callback) {
                var book_id = book_id
                connection.query("SELECT b_id,b_name,DATE_FORMAT(b_release,'%m-%d-%Y') as b_release_date,s_id,u_id FROM books WHERE b_id = ?",[book_id], callback);
            }
            function find_series(book_row, book_field, callback) {
                series_id = book_row[0].s_id
                if (book_row[0].u_id != req.user.id) {
                    return res.send("<h1>this is not your book</h1>")
                }
                book_info.push(book_row[0]);
                connection.query("SELECT * FROM series WHERE s_id = ?",[series_id], callback);
            }
            function find_publisher(series_row, series_field, callback) {
                var publisher_id = series_row[0].p_id
                book_info.push(series_row[0]);
                connection.query("SELECT * FROM publishers WHERE p_id = ?",[publisher_id], callback);
            }
            function find_catagories(publisher_row, publisher_field, callback) {
                book_info.push(publisher_row[0]);
                connection.query("SELECT * FROM catse JOIN categories ON catse.c_id=categories.c_id WHERE s_id= ?",[series_id], callback);
            }
            function all_series(categories_row, categories_field, callback) {
                book_info.push(categories_row);
                connection.query("SELECT * FROM series;", callback);
            }
            function all_publishers(all_sereis_row, all_series_field, callback) {
                all_series_info = all_sereis_row;
                connection.query("SELECT * FROM publishers;", callback);
            }
            function all_categories(all_publishers_row, all_publishers_field, callback) {
                all_publishers_info = all_publishers_row;
                connection.query("SELECT * FROM categories;", callback);
            }
        } else {
            res.redirect('/list')
        }
	});

    // DELETE THEN LOAD LIST PAGE
	app.post('/delete/:id', isLoggedIn, function(req, res) {
        var book_id = req.params["id"]
        connection.query("DELETE FROM books WHERE b_id = "+book_id, function(err, results){
            res.redirect('/list');
        });
	});

    // book info page
    function load_bookPage(request, response, success_msg, info_msg, danger_msg) {
        var book_info = []
        async.waterfall([
            async.apply(find_book, request.params["id"]),
            find_series,
            find_publisher,
            find_catagories,
        ], function (err, result) {
            if (err) {
                res.send(err);
            } else {
                book_info.push(result);
                response.render('book.ejs', {
                    user : request.user,
                    username : request.user.username,
                    book_info : book_info,
                    success_msg : success_msg,
                    info_msg : info_msg,
                    danger_msg : danger_msg,
                });
            }
        });
        function find_book(book_id, callback) {
            var book_id = book_id
            connection.query("SELECT b_id,b_name,DATE_FORMAT(b_release,'%m-%d-%Y') as b_release_date,s_id, u_id FROM books WHERE b_id = ?",[book_id], callback);
        }
        function find_series(book_row, book_field, callback) {
            var series_id = book_row[0].s_id
            if (book_row[0].u_id != request.user.id) {
                return response.send("<h1>this is not your book</h1>")
            }
            book_info.push(book_row[0]);
            connection.query("SELECT * FROM series WHERE s_id = ?",[series_id], callback);
        }
        function find_publisher(series_row, series_field, callback) {
            var series_id = series_row[0].s_id
            var publisher_id = series_row[0].p_id
            book_info.push(series_row[0]);
            connection.query("SELECT * FROM publishers WHERE p_id = ?",[publisher_id], function(err, row, field){
                callback(null, row, field, series_id);
            });
        }
        function find_catagories(publisher_row, publisher_field, series_id, callback) {
            var series_id = series_id;
            book_info.push(publisher_row[0]);
            connection.query("SELECT * FROM catse JOIN categories ON catse.c_id=categories.c_id WHERE s_id= ?",[series_id], callback);
        }
        
    }
    app.get('/book/:id', isLoggedIn, function(req, res) {
        var paramID = parseInt(req.params["id"])
        if(typeof paramID==='number' && (paramID%1)===0) {
            load_bookPage(req, res, "", "", "");
        } else {
            res.redirect('/list')
        }
    });

    app.post('/upload/:id', isLoggedIn, function (req, res){
        var book_id = req.params["id"];
        var form = new formidable.IncomingForm();
        var validFileType = false;
        
        form.encoding = 'utf-8';
        
        form.uploadDir = __dirname + "\\uploads\\";
        if (!fs.existsSync(form.uploadDir)){
            fs.mkdirSync(form.uploadDir);
        }
        
        form.parse(req);
        
        form.on('fileBegin', function (name, file){
            file.path = form.uploadDir + '\\' + file.name;
            if (file.type.split('/')[0] == "image"){
                validFileType = true;
            }
            if (validFileType) {
                form.on('file', function (name, file){
                    var finals = path.join(form.uploadDir + book_id + "_cover");
                    fs.rename(file.path, finals);
                });
                load_bookPage(req, res, "Sucessfully saved book cover !", "", "");
            } else {
                validFileType = false;
                load_bookPage(req, res, "", "", "Invalid file type !");
            }
        });
    });
    
    app.post('/search', isLoggedIn, function (req, res){
        var keyword = req.body.keyword;
        var searchIn = req.body.search_in;
        var searchQuery;
        if (keyword == "" || keyword.trim().length == 0 || keyword == null) {
            res.send("Please enter something.");
        } else {
            if (searchIn == "Book name") {
                searchQuery = "SELECT b_id,b_name FROM books WHERE b_name LIKE '%"+keyword+"%' AND u_id="+req.user.id+";"
            } else if (searchIn == "Series"){
                searchQuery = "SELECT b_id,b_name FROM books JOIN series ON books.s_id=series.s_id WHERE s_name LIKE '%"+keyword+"%' AND u_id="+req.user.id+";";
            } else if (searchIn == "Publisher"){
                searchQuery = "SELECT b_id,b_name FROM books JOIN (series JOIN publishers ON series.p_id=publishers.p_id) ON books.s_id=series.s_id WHERE p_name LIKE '%"+keyword+"%' AND u_id="+req.user.id+";";
            } else {
                searchQuery = ""
            }
            connection.query(searchQuery, function(err, result){
                if (!err) {
                    res.render('search.ejs', {
                        user : req.user,
                        username : req.user.username,
                        results : result,
                        keyword : keyword,
                        search_in : searchIn,
                        error_msg : "",
                    });
                } else {
                    res.render('search.ejs', {
                        user : req.user,
                        username : req.user.username,
                        results : "",
                        keyword : keyword,
                        search_in : searchIn,
                        error_msg : "No results found.",
                    });
                }
            });
        }
    });
    
	app.get('/search', isLoggedIn, function(req, res) {
		res.redirect('/list')
	});
    
	// =====================================
	// PROFILE SECTION =====================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, function(req, res) {
		res.render('profile.ejs', {
			user : req.user, // get the user out of session and pass to template
            username : req.user.username,
		});
	});

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	// =====================================
	// 404 ERROR ===========================
	// =====================================
    
	app.get('*', function(req, res) {
		res.redirect('/list')
	});
};

// route middleware to make sure
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}