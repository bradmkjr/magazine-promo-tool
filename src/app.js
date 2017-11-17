var express = require('express');
var app = express();

var Twit = require('twit');
var sqlite3 = require('sqlite3').verbose();

var cache = require('sqlcachedb');

var Bitly = require('bitly');

var cheerio = require('cheerio');
var request = require('request');

var amazon = require('amazon-product-api');

var pj = require('phrasejumble');

var fs = require('fs');
var Jimp = require("jimp");

var title = '';
var category = '';
var coupon = '';
var description = '';
var amazonImg = '';
var amazonURL = '';
var shortURL = ''; 
var longURL = '';

var b64content = '';

var response = '';

var tags = ['#Amazon', '#PROMO', '#Savings', '#Discount', '#SALE', '#Bargin', '#Promotion', '#Coupon', '#DEALS', '#special', '#Offer', '#FrugalLiving', '#couponing', '#blackfriday'];

var blackFridayTags = ['#blackfriday'];
    // '#blackfridaysavings' , '#blackfridayads', '#blackfridayad', '#blackfridaysale'

// var goldBoxDealsURL = 'https://rssfeeds.s3.amazonaws.com/goldbox';

var goldBoxDealsURL = 'http://www.feedrinse.com/services/rinse/?rinsedurl=ed26e7615b3c6d3b3ecb5c46910c84a6';

var promoCodesURL = 'https://affiliate-program.amazon.com/resource-center/amazon-promo-codes-for-associates/';

var nodeURL = 'https://www.amazon.com/b/ref=sr_aj?node=';

console.log('Starting Up!!!');

/**
*
* Http Server
*
*/

app.set('port', (process.env.PORT || 5000));

// // views is directory for all template files
// // app.set('views', __dirname + '/views');
// // app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  res.writeHead(403, {'Content-Type': 'text/html'}); 

  res.write('Go Away');
  res.end();
});

app.get('/subscribe', function(req, res) {
  // Start process
  // parseHTML();
  // response.render('pages/index')
  // response.send( 'Running' );

  res.writeHead(200, {'Content-Type': 'text/html'}); 

  var T = new Twit( {
      consumer_key: process.env.twitter_consumer_key,
      consumer_secret: process.env.twitter_consumer_secret,
      access_token: process.env.twitter_access_token,
      access_token_secret: process.env.twitter_access_token_secret
    } );
    
  var client = amazon.createClient({
	  awsId: process.env.aws_id,
	  awsSecret: process.env.aws_secret,
	  awsTag: process.env.amazon_tracking_id
	});  

  res.write('Starting Subscribe...');
  loadGoldBoxDeals();

  function loadGoldBoxDeals(){

	cache.getCache(goldBoxDealsURL, function(err,data){
        if(err || data == undefined ){
        	// cache MISS
        	console.log('Amazon Feed: cache MISS')
        	//res.write('cache MISS');
        	request(goldBoxDealsURL, function(error, response, data){

        		// console.log(data);
				// First we'll check to make sure no errors occurred when making the request
		        if(!error){		       
					cache.setCache(goldBoxDealsURL,data, function(){
						console.log('Amazon Feed: cache SET')
						processGoldBoxDeals(data);
					});
		        }else{
			        console.log('Request FAILED');
		        }
		    });     
        
        }else{
        	// cache HIT
        	console.log('Amazon Feed: cache HIT');
        	//res.write('cache HIT');
        	processGoldBoxDeals(data);	
        }
    });
    
   } // end  function loadGoldBoxDeals
    
    function processGoldBoxDeals(html){
	
		var $ = cheerio.load(html, { xmlMode: true });
	
		// $('item').eq( getRandomRange( 0, $('item').length ) ).filter(function(){
		
		// $('item').eq( getRandomRange( 0, 25 ) ).filter(function(){
		
		// var limit = getRandomRange( 0, $('item').length );
		
		// console.log(limit);
		
		// for( i = 0; i <= limit; i++ ){
		
		$('item').eq( getRandomRange( 0, $('item').length ) ).filter(function(){
		
			// console.log('Waiting.. ');
			// wait(2000);
		
		    // $('item').each(function(){
		
			// $('item').eq( i ).filter(function(){
			
			if( -1 == $( 'title', this ).text().indexOf('issues for only') ){
				console.log('Not a Magazine');
				return;
			}
		
	        // var data = $(this);
	        var item = {};
	        
	        // console.log(item);
	       	item.longURL = $( 'link', this ).text().replace( 'rssfeeds-20', process.env.amazon_tracking_id );
	        item.title = $( 'title', this ).text();
	        item.offer = $( 'title', this ).text();
	        item.description = $( 'description', this ).text();
	 
	        storeItem(item);
	       
		}); // end filter()
			
		// } // end for	
	
	} // end function processGoldBoxDeals

	function storeItem(item){
	
		   console.log('Storing Item');
	
		   
	       console.log('Title: '+item.title);
	       // console.log(item.description);
	       console.log('Long URL: '+item.longURL);
	       
	       item.ASIN = getAsin(item.longURL);
	       
	       if( item.ASIN == undefined || item.ASIN.length != 10 ){
	       	   console.log('Invalid ASIN');
		       return;
	       }
	       
	       cache.getCache(item.longURL, function(error,data){
	       		if( error || data == undefined ){
	        	// cache MISS
	        	console.log('bitly: cache MISS');
	        	// console.log(data);
	        	
	        	var bitly = new Bitly( process.env.bitly_access_token );
	       
		       bitly.shorten(item.longURL)
				.then(function(response) {
					// Do something with data 
					item.shortURL = response.data.url;
		
					console.log('Short URL: '+item.shortURL);
			
					cache.setCache(item.longURL, response.data.url, function(){
							console.log('bitly: cache SET');
										
							lookupItem(item);
						}); 		
		
				}, function(error) {
					
					throw error;
				});
	        
	        }else{
	        	// cache HIT
	        	console.log('bitly: cache HIT');
	        	
	        	item.shortURL = data;
	        	console.log('Short URL: '+item.shortURL);

	        	
	        	lookupItem(item);
	        }
	    }); // end cache.getCache
	       
	       	  
	
	} // end function storeItem
	
	function lookupItem(item){
	
		cache.getCache(item.ASIN, function(error,data){
	        if( error || data == undefined ){
	        	// cache MISS
	        	console.log('Amazon: cache MISS');
	        	// console.log(data);
	        	
	        	client.itemLookup({
				  idType: 'ASIN',
				  itemId: item.ASIN,
				  responseGroup: 'Medium,EditorialReview,BrowseNodes'
					}, function(error, data, response) {
					  if (error) {
					    console.log(error);
					    console.log('Amazon API Request FAILED');
						return;
					  } else {
					    // console.log(data);
					    
					    cache.setCache(item.ASIN, JSON.stringify(data), function(){
							console.log('Amazon: cache SET');
							item.data = data;
										
							processItem(item);	
						}); 
					  }
					}); // end client.itemLookup 
	        
	        }else{
	        	// cache HIT
	        	console.log('Amazon: cache HIT');
	        	//res.write('cache HIT');
	        	item.data = JSON.parse(data);
	        	processItem(item);	
	        }
	    }); // end cache.getCache
		
	} // end function lookupItem(
	
	function processItem(item){
		
		// Got item lets use promot it!
		// console.log(item.data[0].ItemAttributes[0].Title[0]);
		
		// console.log(item);
		
		if( item.data[0].ItemAttributes[0].Title[0] == undefined ){
			console.log('Invalid Title');
			return;
		}
		
		item.title = item.data[0].ItemAttributes[0].Title[0];
		
		// console.log(item.data[0].EditorialReviews[0].EditorialReview[0].Content[0]);
		
		item.review = '';
		
		if( item.data[0].EditorialReviews != undefined && item.data[0].EditorialReviews[0].EditorialReview[0].Content[0] != undefined ){
			item.review = item.data[0].EditorialReviews[0].EditorialReview[0].Content[0];
		}
		
		item.tweet = statusUpdate( item.title + ': ' + item.offer, item.review, item.shortURL );
		
		console.log( 'Tweet: ' + item.tweet );
		
		// console.log(item.data[0].LargeImage[0].URL[0]);
		
		if( item.data[0].LargeImage == undefined || item.data[0].LargeImage[0] == undefined || item.data[0].LargeImage[0].URL[0] == undefined ){
			console.log('Invalid Large Image');
			return;		
		}else{
			item.image = item.data[0].LargeImage[0].URL[0];
		}
		
		// console.log( item.data[0].BrowseNodes[0].BrowseNode[0].Name[0] );
		
		item.node = '';
		if( item.data[0].BrowseNodes != undefined && item.data[0].BrowseNodes[0].BrowseNode[0].Name[0] != undefined ){
			item.node = item.data[0].BrowseNodes[0].BrowseNode[0].Name[0];
		}
		
		item.nodeId = '';
		if( item.data[0].BrowseNodes != undefined && item.data[0].BrowseNodes[0].BrowseNode[0].BrowseNodeId[0] != undefined ){
			item.nodeId = item.data[0].BrowseNodes[0].BrowseNode[0].BrowseNodeId[0];
		}
		
		// console.log(item);
		
		
		// 
		
		waterMark(item)
		
	} // end function processItem
	
	function waterMark(item){
		
		// open a file called "lenna.png" 
		Jimp.read(item.image).then(function (image) {
		    // do stuff with the image 

		    Jimp.read('./src/public/assets/img/background.png').then(function (background) {
		    
		    Jimp.read('./src/public/assets/img/twitter-circle.png').then(function (twitter) {
		
		    Jimp.loadFont(Jimp.FONT_SANS_32_BLACK, function (error, fontLargeBlack) {

		    	Jimp.loadFont(Jimp.FONT_SANS_16_BLACK, function (error, fontSmallBlack){

		    		image.composite( background, 0, ( image.bitmap.height - ( ( image.bitmap.height / 3 ) + 60 ) ) )
		    		.composite( twitter, 28, ( image.bitmap.height - ( ( image.bitmap.height / 3 ) + 30 ) ) )
			    	// .print(fontWhite, 70, ( image.bitmap.height - ( image.bitmap.height / 3 ) ), "@"+process.env.twitter_handle )
			    	.print(fontSmallBlack, 85, ( image.bitmap.height - ( ( image.bitmap.height / 3 ) + 54 ) ), item.offer, 330 )
			    	.print(fontLargeBlack, 68, ( image.bitmap.height - ( ( image.bitmap.height / 3 ) + 34 ) ), "@"+process.env.twitter_handle )
			    	.write('./src/public/assets/img/image.processed.jpg', function(){

			    			item.b64content = fs.readFileSync('./src/public/assets/img/image.processed.jpg', { encoding: 'base64' });

			    			// console.log(item.b64content);

			    			tweetWithMedia(item);	

			    			
				    	}); // end write callback

			    	}); // end white font callback 

		    	});	// end blackfont font callback	    	

		    });	// end twitter image read
		    
		    });	// end background image read

		}).catch(function (error) {
		    // handle an exception 
		    console.log(error);

		});
		
	}
	
	function tweetWithMedia(item){

		// 
		// post a tweet with media 
		// 	
		 
		// first we must post the media to Twitter 
		T.post('media/upload', { media_data: item.b64content }, function (error, data, response) {
		  // now we can assign alt text to the media, for use by screen readers and 
		  // other text-based presentations and interpreters 
		  
		  if(error != undefined || response.statusCode != 200 ){
		  	console.log("Something went wrong!");
			console.log(error.message);
			console.log(response.statusCode);
			res.end();		  
		  }else{
			  
			  var mediaIdStr = data.media_id_string
			  var meta_params = { media_id: mediaIdStr, alt_text: { text: item.title + ' ' + item.offer } }
			 
			  T.post('media/metadata/create', meta_params, function (error, data, response) {
			    if(error != undefined || response.statusCode != 200 ){
			      	console.log(error);
			    	console.log(response.statusCode);
			    	
			    	// error with media create
			    	console.log('error creating meta data');
			    		
			    }else{
					// now we can reference the media and post a tweet (media will attach to the tweet) 
					// this is the tweet message
					var tweet = { status: item.tweet, media_ids: [mediaIdStr] } 
					
					// console.log(tweet);
					
					T.post('statuses/update', tweet, function (error, data, response) {

						    if(error != undefined || response.statusCode != 200 ){
									console.log("Something went wrong!");
									console.log(error.message);
									console.log(response.statusCode);
									res.end();
							   
							    }else{
					
						      // res.write('Voila It worked!');
					
						      T.get('statuses/oembed', { "id": data.id_str },  function (error, data, response) {
						      					            
						            if(error != undefined || response.statusCode != 200 ){
										console.log("Something went wrong!");
										console.log(error.message);
										console.log(response.statusCode);
										res.end();
								   
								    }else{
										res.write(data.html);            
										checkList(item);	            
							        }
					            
					         }); // end statuses/oembed
					
						    } // end if
					
						}); // end statuses/update
			    } // end if
			  }); // end media/metadata/create	
			  		  
		  } // end if
		}); // end media/upload

	} // end tweetWithMedia
	
	
	
	
	function checkList(item){
	
		if( item.node == undefined || item.nodeId == 0 ){
			console.log('No Node');
			return;
		}
	
		console.log(item.node);
		
		console.log(item.nodeId);
		
		item.listTitle = item.node+' Magazines'; 
		
		item.listSlug = item.node.replace('&','and').replace(',','').replace(/\s+/g, '-')+'-Magazines'; 
		
		item.listDescription = item.node+' Magazine readers & fans. Browse more ' + item.listTitle + ' at '+ item.shortNodeURL;
				
		var replacements = [];
		
		replacements.push({ title_find: 'Horticulture-Magazines', 
							title_replace: 'Culture-Mag',
							desc_find: 'Gardening & Horticulture Magazine',
							desc_replace: 'Gardening & Culture Magazine' });
							
		replacements.push({ title_find: 'Investing-Magazines',  // , 
							title_replace: 'Invest-Mags',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Motorcycles-Magazines', // 'Motorcycles-Magazines', 'Cycles-Mags'
							title_replace: 'Cycles-Mags',
							desc_find: '',
							desc_replace: '' });	
							
		replacements.push({ title_find: 'History-and-Nature-Magazines', // 'History-and-Nature-Magazines', 'and-Nature-Mags'
							title_replace: 'and-Nature-Mags',
							desc_find: '',
							desc_replace: '' });																						

		replacements.push({ title_find: 'Other-Eastern-Religions-Magazines', // 'Other-Eastern-Religions-Magazines', 'Eastern-Religions-Mags'
							title_replace: 'Eastern-Religions-Mags',
							desc_find: 'Other Eastern Religions Magazine',
							desc_replace: 'Eastern Religions Magazine' });
							

		replacements.push({ title_find: 'City-and-Regional-Magazines', // 'City-and-Regional-Magazines', 'Regional-Magazines'
							title_replace: 'Regional-Magazines',
							desc_find: 'Travel, City & Regional Magazines',
							desc_replace: 'Travel Regional Magazines' }); 
							
		replacements.push({ title_find: 'and-Hobbies-Magazines', // 'Hobbies-Magazines', 'Hobbies-Mags'
							title_replace: 'Magazines',
							desc_find: '',
							desc_replace: '' });
							
		replacements.push({ title_find: 'Teen-Magazines', // 'Teen-Magazines', 'Teen-Mags'
							title_replace: 'Teen-Mags',
							desc_find: '',
							desc_replace: '' });
							
		replacements.push({ title_find: 'Fitness-and-Wellness-Magazines', // 'Fitness-and-Wellness-Magazines', 'and-Wellness-Mags'
							title_replace: 'and-Wellness-Mags',
							desc_find: '',
							desc_replace: '' });
							
		replacements.push({ title_find: 'Style-Magazines', // 'Style-Magazines', 'Style-Mags'
							title_replace: 'Style-Mags',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Firearms-Magazines', // 'Firearms-Magazines', 'Firearms-Mags'
							title_replace: 'Firearms-Mags',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 's-and-Techniques-Magazines', // 's-and-Techniques-Magazines', '-Magazines'
							title_replace: '-Magazines',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'and-Decoration-Magazines', // 'and-Decoration-Magazines', 'Magazines'
							title_replace: 'Magazines',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Nature-Magazines', // 'Nature-Magazines', 'Nature-Mags'
							title_replace: 'Nature-Mags',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Pets-and-Animals-Magazines', // 'Pets-and-Animals-Magazines', 'Animals-Magazines' 
							title_replace: 'Animals-Magazines',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Improvements-Magazines', // 'Improvements-Magazines', 'Magazines'
							title_replace: 'Magazines',
							desc_find: 'How-to & Home Improvements Magazine',
							desc_replace: 'How-to & Home Magazine' });
																												
		replacements.push({ title_find: 'Music-and-Photography-Magazines', // 'Music-and-Photography-Magazines', 'and-Music-Magazines'
							title_replace: 'and-Music-Magazines',
							desc_find: 'Arts, Music & Photography Magazine',
							desc_replace: 'Arts & Music Magazine' });

		replacements.push({ title_find: 'and-Commentary-Magazines', // 'and-Commentary-Magazines', 'Magazines'
							title_replace: 'Magazines',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Cooking-Food-and-Wine-Magazines', 
							title_replace: 'Cooking-and-Wine-Magazine',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Art-and-Art-History-Magazines', 
							title_replace: 'Art-and-History-Magazines',
							desc_find: '',
							desc_replace: '' });
		
		replacements.push({ title_find: 'Antiques-and-Collectibles-Magazines', 
							title_replace: 'Antiques-Magazines',
							desc_find: '',
							desc_replace: '' });

		replacements.push({ title_find: 'Sustainable-Living-Magazines', 
							title_replace: 'Sustainable-Magazines',
							desc_find: 'Sustainable Living Magazine',
							desc_replace: 'Sustainable Magazine' });

		replacements.push({ title_find: 'Wine-and-Cocktails-Magazines', 
							title_replace: 'Wine-and-Drink-Magazines',
							desc_find: 'Wine & Cocktails Magazine',
							desc_replace: 'Wine & Drinks Magazine' });

		replacements.push({ title_find: 'Entrepreneurship-Magazines', 
							title_replace: 'Entrepreneurship-Magazine',
							desc_find: 'Entrepreneurship-Magazines',
							desc_replace: 'Entrepreneurship-Magazine' });

		replacements.push({ title_find: '', 
							title_replace: '',
							desc_find: '',
							desc_replace: '' });

		
		// console.log(replacements);
		
		console.log( 'Before Replacement: ' + item.listSlug );
		console.log( 'Before Replacement: ' + item.listDescription );
				
		for(i = 0; i < replacements.length; i++){
			
				item.listSlug = item.listSlug.replace( replacements[i].title_find, replacements[i].title_replace );
				
				item.listDescription = item.listDescription.replace( replacements[i].desc_find, replacements[i].desc_replace )
														   .replace( replacements[i].desc_find, replacements[i].desc_replace );
			
		}
		
		console.log( 'After Replacement: ' + item.listSlug );		
		console.log( 'After Replacement: ' + item.listDescription );
		
		// console.log( item.listTitle );
		// console.log( item.listSlug );
		
	  	item.nodeURL = nodeURL + item.nodeId + '&ajr=0&tag=' + process.env.amazon_tracking_id;
	  	
	  	console.log(item.nodeURL);	  	
	  	
	  	//
		//  Creates a new list for the authenticated user. Note that you can create up to 1000 lists per account.
		//
		T.get('lists/list', {  reverse: true }, function(error, data, response) {
		  // console.log(data);
		  // console.log(data.statuses.length);
		  // console.log(response);
	
		  if( data != undefined && !error && response.statusCode == 200 ){
		  	// res.write(JSON.stringify(data));	
		  	
	 		  // console.log(data);
	 		  item.list = {};
	 		  
	 		  var found = undefined;
	 		  
	 		  // console.log(data.length);
	 		  
	 		  for(i = 0; i < data.length; i++){
		 		
		 		// console.log(data[i]);
		 		
		 		if( data[i].name == item.listSlug ){
			 		// list match
			 		// console.log(data[i]);
			 		item.list.id = data[i].id;
			 		item.list.id_str = data[i].id_str;
			 		item.list.list_id = data[i].id_str;
			 		
			 		found = true;
		 		}	  
		 		  
	 		  }
	 		  
	 		  // console.log(found);
	 		  
	 		  if( found == undefined){
		 		  
		 		  console.log('List Not Found');
		 		  createShortNodeURL(item);
		 		  
	 		  }else{
		 		  console.log('List Found');
		 		  console.log(item.list);
		 		  
		 		  searchTwitter(item);
	 		  }
	 		  
		  } // end if
		  else if( error )
		  {
			console.log(error);	
			console.log(data);
			console.log(response.statusCode);
		  }
		  
		}); // end lists/create
	  	
	} // end function checkList
	
	function createShortNodeURL(item){
		
		cache.getCache(item.nodeURL, function(error,data){
	       		if( error || data == undefined ){
	        	// cache MISS
	        	console.log('bitly: cache MISS');
	        	// console.log(data);
	        	
	        	var bitly = new Bitly( process.env.bitly_access_token );
	       
		       bitly.shorten(item.nodeURL)
				.then(function(response) {
					// Do something with data 
					item.shortNodeURL = response.data.url;
		
					console.log('Short Node URL: '+item.shortNodeURL);
			
					cache.setCache(item.nodeURL, response.data.url, function(){
							console.log('bitly: cache SET');
										
							createList(item)
						}); 		
		
				}, function(error) {
					
					throw error;
				});
	        
	        }else{
	        	// cache HIT
	        	console.log('bitly: cache HIT');
	        	
	        	item.shortNodeURL = data;
	        	console.log('Short Node URL: '+item.shortNodeURL);

	        	createList(item)
	        	
	        }
	        
	      }); // end cache.getCache  
		
	} // end function createShortNodeURL


	function createList(item){
		
		//
		//  Creates a new list for the authenticated user. Note that you can create up to 1000 lists per account.
		//
		T.post('lists/create', { name: item.listSlug, description: item.listDescription  }, function(error, data, response) {
		  // console.log(data);
		  // console.log(data.statuses.length);
		  // console.log(response);
	
		  if( data != undefined && !error && response.statusCode == 200 ){
		  	// res.write(JSON.stringify(data));	
		  	
	 		  item.list.id = data.id;
			  item.list.id_str = data.id_str;
			  item.list.list_id = data.id_str;
			  
			  // item.list.owner_id = data.user.id_str;
			 	
			  console.log(item.list);
			  
			  searchTwitter(item)		
		  	
		  } // end if
		  else if( error )
		  {
			console.log(error);	
			console.log(data);
			console.log(response.statusCode);
		  }
		  
	
		}); // end lists/create
		
	}
	
	function searchTwitter(item){
	
		console.log('Twitter Search: '+ item.title);
	
		//
		//  search twitter for all tweets containing the word '#coupon'
		//
		T.get('search/tweets', { q: item.title, count: 1, result_type: 'recent' }, function(error, data, response) {
		  // console.log(data);
		  // console.log(error);
		  // console.log(response);
	
		  if( data != undefined && !error && response.statusCode == 200 && data.statuses.length != 0 ){
		  	// res.write(JSON.stringify(data));	
		  	
		  	var status = data.statuses[0];
	
		  	console.log(status.text);
		  	res.write( 'Tweet: ' + status.text );	
	
		  	// res.write( status.user.id_str );	
		  	res.write( 'User: ' + status.user.name );	
		  	// console.log( status.user.screen_name );	
		  	res.write( 'Screen Name: ' + status.user.screen_name );	
		  	
		  	T.post('friendships/create', { user_id: status.user.id_str }, function(error, data, response) {
	
		  		// console.log(data);
		  		// console.log(response);
	
		  		if( data != undefined && !error && response.statusCode == 200 ){
	
		  			// console.log(response);
		  			console.log('Following Status: ' + data.following);
		  			res.write( 'Following Status: ' + data.following );	

		  			console.log('Item: ' + item);
	
		  			console.log('List ID: '+ item.list.list_id);
	
					T.post('lists/members/create', { list_id: item.list.list_id, user_id: status.user.id_str, screen_name: status.user.screen_name }, function(error, data, response) {
	
				  		// console.log(data);
				  		// console.log(response);
	
				  		if( data != undefined && !error && response.statusCode == 200 ){
	
				  			// console.log(response);
				  			console.log( data.member_count );
				  			res.write( 'Member Count: '+data.member_count );	
				  			// console.log(data);
				  		}
				  		else if( error )
				  		{
							console.log(error);	  			
				  		}
	
				  		res.end();	
				  	});
	
		  		}
		  		else if( error )
		  		{
					console.log(error);	  			
		  		}
	
		  		// res.end();	
	
		  	});
		  	
		  } // end if
		  else if( error )
		  {
			console.log(error);	
			console.log(data);
			console.log(response.statusCode);
		  }
		  
	
		}); // end search/tweets
		
		
	} // end function searchTwitter

}); // end get /subscribe


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


function statusUpdate( category, description, shortURL ){

  var statusUpdate = '';

  var optionalTag = (getRandomRange(0,tags.length) > 4)?' '+ tags[getRandomRange(0,tags.length)] +' ':'';

  var maxLength = 279 - ( category.length + 2 + shortURL.length + optionalTag.length + 1 );
  
  console.log(maxLength);

  statusUpdate = category + ' ' + shortURL + ' ' + trimWords(description, maxLength) + optionalTag ;

  return statusUpdate;
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function getRandomRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function trimWords(description, maxLength){
	description = description.replace(/\s\s+/g, ' ')

	description = description.substring(0, maxLength);

	var length = maxLength;
	// console.log(length);
	for (var i = maxLength - 1; i >= 0; i--) {
		if(description[i] == ' '){
			length = i;
			break;
		}	
	};
	// console.log(length);

	return description.substring(0, length);
}

function getAsin(url){
	
	// console.log(url);
	var regex = RegExp("https://www.amazon.com/([\\w-]+/)?(dp|gp/product)/(\\w+/)?(\\w{10})");
	m = url.match(regex);
	// console.log(m);
	if (m) { 
	    console.log("ASIN: " + m[4]);
	    return m[4];
	}

	return undefined;
}


function wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
  }
}