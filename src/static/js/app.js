var T = {};
var tagDict = {};
var tagCompDict = {};
var tagQueue = [];
processTags();
$.xhrPool = [];
$.xhrPool.abortAll = function() {
    $(this).each(function(idx, jqXHR) {
        jqXHR.abort();
    });
    $.xhrPool = [];
};

T.compile = function (template) {
    var compile = Handlebars.compile(template),
        render = {
            render: function (ctx) {
                return compile(ctx);
            }
        };
    return render;
};

function compare(a,b) {
  if (a.rank < b.rank)
     return 1;
  if (a.rank > b.rank)
    return -1;
  return 0;
}

function initTree(items,root){
	var tree = {};
	$.each(items, function( index, node ) {
		var pid = node['parent'].$oid;
		 // print pid
		if(tree[pid]){
			tree[pid].push(node);
		}
		else{
			tree[pid] = [node];
		}

		
	});

	var finalTree = buildTree(tree,root);
	

	return {"content": "ROOT" ,"children" :finalTree};
}

function buildTree(tree,root){
	var lst = tree[root];
	// #sort lst by confidence

	var children = [];
	if(lst){
		
		lst.sort(compare);
		
		$.each(lst, function( index, node ) {

		    var temp = buildTree(tree,node['id'].$oid);

			node.set('children',temp);
			children.push(node);
		});
	}
	return children;
}

$.ajaxSetup({
    beforeSend: function(jqXHR) {
        $.xhrPool.push(jqXHR);
    },
    complete: function(jqXHR) {
        var index = $.xhrPool.indexOf(jqXHR);
        if (index > -1) {
            $.xhrPool.splice(index, 1);
        }
    },
    error : function(jqXHR, textStatus, errorThrown) {
        if (jqXHR.status == 404) {
            //document.location = "/404.html";
        }
        if (jqXHR.status == 401) {
            // localStorage.loggedIn = false;
            // document.location = "/#/login";

        }
        if (jqXHR.status == 500) {
            //document.location = "/500.html";

        }
    }
});

/**************************
* Application
**************************/
window.Flotag = Em.Application.create({
	LOG_TRANSITIONS: true,
	LOG_VIEW_LOOKUPS: true,
	LOG_ACTIVE_GENERATION: true,
	currentPath: '',
	ready : function(){

	}
});


Flotag.Router.map(function() {
	this.resource('login');
	this.resource('index',{path:"/"});
	this.resource('user',{path:"/user/:user_id"});
	this.resource('tag',{path:"/tag/:tag_id"});

	this.resource('verify',{path:"/verify/:reg_id"});
	this.resource('logout');

});

Flotag.Router.reopen({
   //location: 'history',
  rootURL: '/'
});

Ember.Route.reopen({
  render: function(controller, model) {
    this._super();
    window.scrollTo(0, 0);
  }
});

/**************************
* Routes
**************************/


Flotag.LoginRoute = Ember.Route.extend({
	setupController: function(controller,context){
		controller.reset();
	}
});

Flotag.LogoutRoute = Ember.Route.extend({
	beforeModel: function(controller,context){

		this.controllerFor('login').set('loggedIn',false);
		//debugger;
		this.controllerFor('authenticated').reset()
		this.controllerFor('index').reset();
		this.controllerFor('user').reset();
		this.controllerFor('base').reset();
		this.controllerFor('tag').reset();
		var that = this;
		$.get( "/api/auth/logout", function( data ) {
		   that.transitionTo('login');
		   

		});
	}
});
Flotag.AuthenticatedRoute = Ember.Route.extend({

    enter: function(router) {
    	this._super(router);
        window.scrollTo(0,0);
    },

	beforeModel: function(transition){
		var self = this;
		Flotag.User.checkIfLoggedIn().then(this,function(val){
					if(val.status && val.status != 200){

								self.controllerFor('login').set('loggedIn',false);
								self.redirectToLogin(transition);
							
					}
					return val;
		});
		if(this.controllerFor('login').get('loggedIn') == "false" || !this.controllerFor('login').get('loggedIn')){
			this.redirectToLogin(transition);
		}
	},
	
	redirectToLogin: function(transition){
		this.controllerFor('login').set('attemptedTransition',transition);
		this.transitionTo('login');
	},
	
	events : {
		error: function(reason,transition){
			if(reason.status === 401){
				this.redirectToLogin(transition);
			}
			else{
				
			}
		}
	}
});

Flotag.BaseRoute = Flotag.AuthenticatedRoute.extend({

	setupController: function(controller, model){
		var self = this;
		
		this.controllerFor('authenticated').get('currentUserPromise').then(this,function(user){
				if(user.status && user.status != 200){
					// self.controllerFor('login').set('loggedIn',false);
					// document.location = "/#/login";
					 self.controllerFor('base').set("currTags",[]);
				}
				else{

					self.controllerFor('base').set("currTags",Flotag.User.getUserTags(user._id.$oid));

				}

		});
		
		controller.set('model',model);
 		this.controllerFor('base').set("notifications",Flotag.User.getNotifications());
  		this.controllerFor('base').set('searchLoaded',false);


	},


});
Flotag.IndexRoute = Flotag.BaseRoute.extend({

    model: function(params) {
    	return null;

    	
    },  

	setupController: function(controller, model){
		this.controllerFor('posts').reset();

		controller.set('model',[]);
		var self = this;
		self.controllerFor('base').set("currTags",[]);
		self.controllerFor('application').set('isLoading',true);

		Flotag.Post.getFeed().then(null,function(feed){
			if(feed.status && feed.status != 200){
				//document.location = "/#/login";
				controller.set('model',[]);
				self.controllerFor('posts').set('model',[]);
			}
			else{
					self.controllerFor('posts').set('model',feed);
					controller.set('model',feed);
			}
			self.controllerFor('application').set('isLoading',false);




		});
		Flotag.Tag.getTrending(controller.get('trendingTime')).then(null,function(tags){
			//console.log(tags);
			controller.propertyWillChange('trendingTags');
			controller.set('trendingTags',tags);
			console.log(controller.get('trendingTags').length,controller.get('trendingTags'));
			controller.propertyDidChange('trendingTags');
		});
		this._super(controller,model);
		
	}





  
});

Flotag.UserRoute = Flotag.BaseRoute.extend({



	model: function(params) {

		return params.user_id;
	},

	setupController: function(controller, uid){
		this.controllerFor('posts').reset();

		var self = this;
		var _id = {"$oid":uid};
		var tempmodel = Flotag.User.create({"_id": _id});
		
		controller.set('model',tempmodel);
		this._super(controller,tempmodel);
		self.controllerFor('posts').set('model',[]);
		self.controllerFor('application').set('isLoading',true);

		Flotag.User.find(uid).then(null,function(model){
			if(model.status && model.status == 404){
				document.location = "/404.html";
				return;
			}
			controller.set('model',model);
			controller.set("_id.$oid",model._id.$oid);
			controller.set("userCurrTags",Flotag.User.getUserTags(model._id.$oid));
			self.controllerFor('posts').set("feedTags",[model.get('_id')]);
			Flotag.Post.getFeed("erank",1,JSON.stringify([model.get('_id')])).then(null,function(feed){
				self.controllerFor('posts').set('model',feed);
						self.controllerFor('application').set('isLoading',false);

			});
		});
		

		


	}

});

Flotag.TagRoute = Flotag.BaseRoute.extend({



	model: function(params) {

		return params.tag_id;
	},

	setupController: function(controller, tid){
		this.controllerFor('posts').reset();

		var self = this;
		var tempmodel = Flotag.Tag.create({});
		controller.set('content',tempmodel);
		this._super(controller,tempmodel);


		controller.get('application').set('isLoading',true);
		Flotag.Tag.find(tid).then(null,function(model){
			if(model.status && model.status == 404){
				document.location = "/404.html";
				return;
			}
			controller.set('model',model);
			self.controllerFor('posts').set("feedTags",[model.get('_id')]);
			Flotag.Post.getFeed("erank",1,JSON.stringify([model.get('_id')])).then(null,function(feed){
				self.controllerFor('posts').set('model',feed);
				controller.get('application').set('isLoading',false);
			});
		});






	}

});

Flotag.VerifyRoute = Ember.Route.extend({

	model: function(params){
		
		var self = this;
		return $.getJSON("/api/verify?regid=" + params.reg_id+"&_="+Math.random()).then(function(data){
			
			return data.models;
		});
		
	}
});



/**************************
* Models
**************************/
Flotag.ApplicationController = Ember.Controller.extend({

  isLoading: false,

  updateCurrentPath: function() {
  				$(".modal-backdrop").remove();
			$("body").removeClass('modal-open');
			$("#followersModal").modal('hide');
    Flotag.set('currentPath', this.get('currentPath'));
 			var self = this;

  }.observes('currentPath'),
  	jqueryInit: function(){

  	}

});


Flotag.AuthenticatedController = Ember.Controller.extend({

  
  currentUser: null,
  currentUserPromise: null,
  
  init: function(){
  	//set current user
  		
  		var self = this;
		if(this.controllerFor('login') && this.controllerFor('login').get('loggedIn') != "false" && this.controllerFor('login').get('loggedIn')){
			var dfd = Flotag.User.getCurrentUser().then(null,function(val){
				if(val.status && val.status != 200){

				}
				else{
					self.set('currentUser',val);

				}
				return val;
			});
			
			self.set('currentUserPromise',dfd);

			
		}
  	
  },

  reset: function(){

  	if(this.get('currentUser')){
  		this.get('currentUser').voteDict = {};

  	}
  	this.set('currentUser',null);
  	this.set('currentUserPromise',null);
  },


  refreshUser: function(){
  	var self = this;
	var dfd = Flotag.User.getCurrentUser().then(this,function(val){
		self.propertyWillChange('profileImgUrl');
		self.set('currentUser',val);
		self.propertyDidChange('profileImgUrl');
		return val;
	});
	self.set('currentUserPromise',dfd);
	return dfd;
  },


  profileImgUrl: function(){

		if(!this.get("currentUser")||!this.get("currentUser")._id ){
			return "";
		}
		return "/api/profile/"+this.get("currentUser")._id.$oid.toString()+"?_="+'?'+Math.random();
	}.property("currentUser"),

  	jqueryInit: function(){

  	}
});

Flotag.User = Em.Object.extend({
	_id: null,
	username: null,
	name: null,
	notifications: [],
	date_created: null,
	default_tags: [],
	current_tags: [],
	votes: [],
	voteDict: {},
	reputation: null,

	userProfileImage: function() {
		//debugger;
	//
		if(!this.get('_id') || !this.get('_id').$oid){
			
			return "";
		}
		return "/api/profile/"+ this.get('_id').$oid;
    }.property("_id"),

	userProfileImageThumbnail: function() {
		//debugger;
	//
		if(!this.get('_id') || !this.get('_id').$oid){
			
			return "";
		}
		return "/api/profile/"+ this.get('_id').$oid+"?thumbnail=true";
    }.property("_id"),

	userUrl: function() {
		//debugger;
	//
		if(!this.get('_id') || !this.get('_id').$oid){
			
			return "";
		}
		return "/#/user/"+ this.get('_id').$oid;
    }.property("_id"),

    userTag: function(){
    	if(!this.get('_id') || !this.get('_id').$oid){
			return "";
		}
		
		return this.get("_id");
    }.property('_id.$oid')

});

Flotag.Notification = Em.Object.extend({


});
		$(".modal-backdrop").remove();
  		$('body').removeClass('modal-open');
Flotag.Tag = Em.Object.extend({

	tagProfileImage: function() {
		//debugger;
	//
		if(!this.get('_id') || !this.get('_id').$oid){
			return null;
		}
		
		return "/api/profile/"+ this.get('_id').$oid;
    }.property('_id.$oid'),

	tagProfileImageThumbnail: function() {
		//debugger;
	//
		if(!this.get('_id') || !this.get('_id').$oid){
			return null;
		}
		
		return "/api/profile/"+ this.get('_id').$oid+"?thumbnail=true";
    }.property('_id.$oid'),

});

Flotag.Tag.reopenClass({

	find: function(tagId){
        var tag = Flotag.Tag.create({}); //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/tag/"+tagId,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

				
			},
			dataType: "application/json"
			//contentType : "application/json"
		}).then(null,function(data){
				if(data.status != 200 && data.status != 304){
					return data;
				}
				data = JSON.parse(data.responseText);
				if(data.models.tags && data.models.tags.name){
					data.models.tags.name = data.models.tags.name.capitalize();
				}
					tag.setProperties(data.models.tags);			

				return tag;
		});
	},
    updateTag: function(tagid,about,img){
		var putData = 
			{"models" : {
				"tag": {
						"about" : about,
						},
						"profile_img" : img}};
    	var ret = $.ajax({
			type: "PUT",
			url : "/api/tag/"+tagid,
			data: JSON.stringify(putData),
			
			dataType: "application/json",
			contentType : "application/json"
		});
		return ret;
    },
	getTags: function(tagids){
        var tags = []; //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/tag?tag_ids="+tagids,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

				
			},
			dataType: "application/json"
			//contentType : "application/json"
		}).then(null,function(data){
				if(data.status != 200 && data.status != 304){
					return data;
				}
				data = JSON.parse(data.responseText);
				data.models.tags.forEach(function(tag){
                	var model = Flotag.Tag.create(tag); 
                	tags.addObject(model); //fill your array step by step
                	//model.set('post',that);


				});
				console.log(tags);

				return tags;		

		});
	},

	getTrending: function(hoursago){
        var tags = []; //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/tag/trending?timeago="+hoursago,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

				
			},
			dataType: "application/json"
			//contentType : "application/json"
		}).then(function(data){
		},function(data){
				data = JSON.parse(data.responseText);
				data.models.tags.forEach(function(tag){
                	var model = Flotag.Tag.create(tag); 
                	tags.addObject(model); //fill your array step by step
                	//model.set('post',that);


				});

				return tags;
		});
	},

	getRandom: function(excludes,nresults){
        var tags = []; //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/tag/random?nresults="+nresults+"&exclude="+excludes,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

				
			},
			dataType: "application/json"
			//contentType : "application/json"
		}).then(function(data){
		},function(data){
				data = JSON.parse(data.responseText);
				data.models.tags.forEach(function(tag){
                	var model = Flotag.Tag.create(tag); 
                	tags.addObject(model); //fill your array step by step
                	//model.set('post',that);


				});

				return tags;
		});
	},

	saveTag: function(nme,abt,image){
		var postData = {models: {tag:{name: nme,about : abt}}};

		if(image){
			   postData = {models: {tag:{name: nme,about : abt},"profile_img":image}};

		}
		
    	var ret = $.ajax({
			type: "POST",
			url : "/api/tag",
			data: JSON.stringify(postData),
			
			dataType: "application/json",
			contentType : "application/json"
		}).then(this,function(data){
			return data;
		});
		return ret;
	}
});

Flotag.Reply = Em.Object.extend({
	datePosted: function(){
		return new Date(this.get('date_created').$date).toGMTString();
	}.property('date_created.$date')
});

Flotag.Reply.reopen({
	upvoted: false,

	downvoted: false
});

Flotag.Reply.reopenClass({


	reply: function(post,reply,text){
    	var replyData = {models: {reply:{content: text}}};
    	var replyId = '';
    	if(reply){
    		replyId = reply.id.$oid;

    	}

    	return $.ajax({
			type: "POST",
			url : "/api/post/"+post._id.$oid+"/reply"+replyId,
			data: JSON.stringify(replyData),
			dataType: "application/json",
			contentType : "application/json"
		});	
	}

});
Flotag.Notification = Em.Object.extend({

	userProfileImage: function() {
		//
		if(!this.get('user') || !this.get('user').$oid){
			return "";
		}
    return "/api/profile/"+ this.get('user').$oid+"?thumbnail=true";
  }.property('user.$oid')

});

Flotag.Post = Em.Object.extend({

	datePosted: function(){
		return new Date(this.get('date_created').$date);
	}.property('date_created.$date')

 //    postTag: function(){
    	
 //    	var tags = this.get('tags');
 //    	var tag = this.get('tags')[0];
 //    	var user = this.get('user');
 //    	if(user._id && tags){
	// 		$.each(tags, function( index, value ) {
	// 			if(value.tag){
	// 				if(value.tag.$oid !== user._id.$oid){
	// 				//	debugger;

	// 					tag = value;
	// 					return false;
	// 				}
	// 			}
	// 			else if(value._id){
	// 				if(value._id.$oid !== user._id.$oid){
	// 				//	debugger;

	// 					tag = value;
	// 					return false;
	// 				}
	// 			}

			
	// 		});
	// 	}
		
	// 	// tag._id = {};
	// 	// tag._id.$oid = tag.tag;
	// 	// this.get('postTag').set()
	// 	return tag;
	// }.property('tags','user')


});

Flotag.Post.reopen({

	previewLoading: false,

	isLink: false,

	isVideoLink: false,

	isImageLink: false,

	embed: null,

	data: null,


	upvoted: false,

	downvoted: false,

	computedEmbed: function(){
		var embed = this.get('embed');
		embed = embed.replace(/http:/g,"https:");
		return embed;
	}.property('embed'),

	replyTree: function() {
		
	    return initTree(this.get('replies'),this.get('_id').$oid);
	  
	  }.property('replies.@each'),
	

 
	getLinks: function() {

	   var value = this.get('content');
	  var escaped = Handlebars.Utils.escapeExpression(value);
	  var expression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/i;
	  var regex = new RegExp(expression);
	  var link = value.match(regex);
	  this.set('isLink',link);
	  this.set("link",link);
	  var that = this;


	  if(link){
	  var link = link[0];
	  if(!link.match(/http:\/\//)&&!link.match(/https:\/\//)){
	  	link = "http://"+ link;
	  }
	  value = value.replace(expression,"");
	  this.set('content',value);

	  this.set('previewLoading',true);
		$.ajax({
			type: "GET",
			url : "/api/media?url="+link,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){
				// if(data.success != 200){
				// 	return;
				// }
				data = JSON.parse(data.responseText);
				
				if(data.embed){
					that.set('isVideoLink',true);
					that.set('embed',data.embed);

				}
				else if(isImage(link,data)){
					that.set('isImageLink',data.image);
					that.set('image',data.image);


				}
				data.link = link;

				that.set("data",data);
					  that.set('previewLoading',false);

				//that.get('view').set('image',data.image);
				
			},
			dataType: "application/json",
			contentType : "application/json"
		});
	}
	}.observes('post_content'),

	getUsers: function() {

	  var value = this.get('user');

	  var that = this;


		$.ajax({
			type: "GET",
			url : "/api/user/"+value.$oid,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){
				data = JSON.parse(data.responseText);
				that.set("user",data.models.user);
				
				//that.get('view').set('image',data.image);
				
			},
			dataType: "application/json"
			//contentType : "application/json"
		});
	
	}.observes('post_content'),

	getReplies: function(page,nresults,sort){
	  if(!page){
	  	page = 1;
	  }
	  if(!nresults){
	  	nresults = 300;
	  }
	  if(!sort){
	  	sort = "rank";
	  }
	  var replies = [];
	  var value = this.get('_id').$oid;
	  var that = this;
		//that.set('repliesLoaded',false);

	  return $.ajax({
			type: "GET",
			url : "/api/post/"+value+"/reply?page="+page+"&nresults="+nresults+"&sort="+sort,
			dataType: "application/json"
			//contentType : "application/json"
		}).then(null,function(data){
				data = JSON.parse(data.responseText);

				data.models.replies.forEach(function(reply){
                	var model = Flotag.Reply.create(reply); 
                	replies.addObject(model); //fill your array step by step
                	model.set('post',that);


				});
				return replies;
		});
		

	}
});

Flotag.Post.reopenClass({


	getFeed: function(sort,page,tags){
        var feed = []; //create an empty object
        feed.set("isLoaded", false);
		if(!page){
			page=1;
		}
		if(!sort){
			sort="erank";
		}
		
		if(!tags){
			tags = ' ';
		}

		
		return $.ajax({
			type: "GET",
			url : "/api/post?sort="+sort+"&page="+page+"&tags="+tags,
			dataType: "application/json"
		}).then(this,function(data){
				if(data.status != 200 && data.status != 304){
					return data;
				}

				data = JSON.parse(data.responseText);
				if(!data.models.posts){
					return [];
				}
            	data.models.posts.forEach(function(post){
                	var model = Flotag.Post.create(post);

                	if(!model.get('reply_count')){
                		model.set('reply_count',0);
                	}
                	model.set('post_content',model.get('content'));
                	feed.addObject(model); //fill your array step by step
                	
            	});
            	feed.set("isLoaded", true);
            	return feed;
            	//
        	});
		
	},

	post: function(text,tags){

    	var postData = {models: {post:{content: text , tags : []}}};
    	$.each(tags, function( index, value ) {
	  		postData.models.post.tags.push(value._id);
		});
		
    	return $.ajax({
			type: "POST",
			url : "/api/post",
			data: JSON.stringify(postData),
				
			
			dataType: "application/json",
			contentType : "application/json"
		}).then(this,function(data){
				return data;
				//Flotag.User.getCurrentUser();
		});

	},

		vote: function(post,istate,reply){
		var postData = {models: {vote:{post_id: post._id.$oid , state : istate}}};
    	if(reply){

    		replyId = reply.id.$oid;
			postData = {models: {vote:{post_id: post._id.$oid ,reply_id : replyId, state : istate}}};
    	}
    	

		
    	return $.ajax({
			type: "POST",
			url : "/api/vote",
			data: JSON.stringify(postData),
				
			
			dataType: "application/json",
			contentType : "application/json"
		});

	}

});

Flotag.User.reopenClass({

    find: function(userId) {
        var user = Flotag.User.create({}); //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/user/"+userId,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

				
			},
			dataType: "application/json"
			//contentType : "application/json"
		}).then(null,function(data){
				if(data.status != 200 && data.status != 304){
					return data;
				}
				data = JSON.parse(data.responseText);
				data.models.user.name = data.models.user.name.capitalize();
				user.setProperties(data.models.user);
				return user;
		});
        
    },

    getCurrentUser: function() {
         //create an empty object
         
		return $.ajax({
			type: "GET",
			url : "/api/user/me?detailed=True",
			dataType: "application/json",
			//contentType : "application/json"
		}).then(this,function(data){
				if(data.status == 401){
					//document.location = "/#/login";
					//$.xhrPool.abortAll();
					return data;
				}
				if(data.status != 200 && data.status != 304){
					return data;
				}
				var user = Flotag.User.create({});
				data = JSON.parse(data.responseText);
				data.models.user.name = data.models.user.name.capitalize();
				user.setProperties(data.models.user);
				user.voteDict = {};
				//
				$.each(user.votes, function( index, value ) {

		  			user.voteDict[value.post_id.$oid] = value;
		  			
				});
				return user;
		});
        
    },

    checkIfLoggedIn: function() {
         //create an empty object
		return $.ajax({
			type: "GET",
			url : "/api/auth/check",
			dataType: "application/json",
			//contentType : "application/json"
		}).then(this,function(data){
				return data;
		});
        
    },
    getNotifications: function() {
        var notifications = []; //create an empty object
		$.ajax({
			type: "GET",
			url : "/api/nots",
			//data: JSON.stringify({"args" : data }),
			complete: function(data){
				if(data.status != 200 && data.status != 304){
					return;
				}
				data = JSON.parse(data.responseText);
            	data.models.notifications.forEach(function(not){
                	var model = Flotag.Notification.create(not); 

                	notifications.addObject(model); //fill your array step by step
                	//
            	});
        	},
				
			
			dataType: "application/json",
			//contentType : "application/json"
		});

        return notifications;
    },



    readAllNotifications: function() {
         //create an empty object
		return $.ajax({
			type: "POST",
			url : "/api/nots/read",
			//data: JSON.stringify({"args" : data }),
			complete: function(data){

        	},
				
			
			dataType: "application/json",
			//contentType : "application/json"
		}).then(null,function(data){
				//data = JSON.parse(data.responseText);
            	//return data;
		});

        
    },

    getFollowers: function(userid){
        var followers = []; //create an empty object
		followers.set('isLoaded',false);

		return $.ajax({
			type: "GET",
			url : "/api/user/"+userid+"/followers",
			dataType: "application/json",
			//contentType : "application/json"
		}).then(this,function(data){
			data = JSON.parse(data.responseText);
			
        	data.models.followers.forEach(function(follower){
            	var model = Flotag.User.create(follower); 
            	model.value = model.name;
            	followers.addObject(model); //fill your array step by step

        	});
        	followers.set('isLoaded',true);

        	return followers;

		});
       ;
    },

    getUserTags: function(userid){
        var currTags = []; //create an empty object
        currTags.set('isLoaded',false);
		$.ajax({
			type: "GET",
			url : "/api/user/"+userid+"/default_tags",
			dataType: "application/json",
			//contentType : "application/json"
		}).then(this,function(data){
			data = JSON.parse(data.responseText);
			
        	data.models.tags.forEach(function(tag){
            	var model = Flotag.Tag.create(tag); 
            	model.value = model.name;
            	currTags.addObject(model); //fill your array step by step

        	});
        	currTags.set("isLoaded", true);

		});
        return currTags;
    },

    getOwnerTags: function(){
        var ownerTags = []; //create an empty object
        ownerTags.set('isLoaded',false);
		return $.ajax({
			type: "GET",
			url : "/api/tag/owner",
			dataType: "application/json",
			//contentType : "application/json"
		}).then(this,function(data){
			data = JSON.parse(data.responseText);
			
        	data.models.tags.forEach(function(tag){
            	var model = Flotag.Tag.create(tag); 
            	model.value = model.name;
            	ownerTags.addObject(model); //fill your array step by step

        	});
        	ownerTags.set("isLoaded", true);
        	return ownerTags;

		});
    },


    updateTags: function(tags) {
    	
    	var postData = {models: {tags:[]}};
    	$.each(tags, function( index, value ) {
	  		postData.models.tags.push(value._id);
		});
		
    	return $.ajax({
			type: "POST",
			url : "/api/user/default_tags",
			data: JSON.stringify(postData),
				
			
			dataType: "application/json",
			contentType : "application/json"
		});
    },
    removeTags: function(tags) {
    	if(!tags){
    		return;
    	}
    	var postData = {models: {tags:[]}};
    	$.each(tags, function( index, value ) {
	  		postData.models.tags.push(value._id);
		});
		
    	return $.ajax({
			type: "DELETE",
			url : "/api/user/default_tags",
			data: JSON.stringify(postData),
				
			
			dataType: "application/json",
			contentType : "application/json"
		});
    },

    changePassword: function(oldPass,newPass){
    	var ret = $.ajax({
			type: "POST",
			url : "/api/password?old_pass="+oldPass+"&new_pass="+newPass,

				
			
			dataType: "application/json"
		});
		return ret;
    },
    updateUser: function(name,about,img){
		var putData = 
			{"models" : {
				"user": {
						"name":name,
						"about" : about,
						},
						"profile_img" : img}};
    	var ret = $.ajax({
			type: "PUT",
			url : "/api/user",
			data: JSON.stringify(putData),
			
			dataType: "application/json",
			contentType : "application/json"
		});
		return ret;
    }
});
/**************************
* Mixins
**************************/
Flotag.Scrolling = Em.Mixin.create({

  bindScrolling: function(opts) {
    var onScroll, _this = this;

    onScroll = function(){ 
        return _this.scrolled(); 
    };

    $(document).bind('touchmove', onScroll);
    $(window).bind('scroll', onScroll);
  },

  unbindScrolling: function() {
    $(window).unbind('scroll');
    $(document).unbind('touchmove');
  }

});



/**************************
* Views
**************************/
Flotag.LoginView = Ember.View.extend({
  classNames: ['login-back'],
  didInsertElement: function(){

    // will be called if rendered inside
    // an OuterView because OuterView's
    // eventManager doesn't handle click events
    loginBack();

  }

});



Flotag.IndexView = Ember.View.extend(Flotag.Scrolling,{
	templateName: 'index',
	didInsertElement: function(){
    // will be called if rendered inside
    // an OuterView because OuterView's
    // eventManager doesn't handle click events
    

    var that = this;
    $('input.typeahead-current-tags').bind('tm:popped tm:spliced',function(event,tagBeingRemoved){
		//console.log(tagBeingRemoved);
		that.get('controller').send("removeCurrentTag",[tagBeingRemoved]);
	});
    $('input.typeahead-current-tags').bind('tm:pushed',function(event,tagBeingAdded){

    	that.get('controller').send("pushCurrentTag",tagBeingAdded);
    });

	$('#ads-load').appendTo("#ads").css("display", "block");

// var img = $('.preview-img');
// var zoomWidthIncrement = img.width() * 1/3;
// var zoomHeightIncrement = img.height() * 1/3;

// img.click(function(){
//     img.css({width: img.width() + zoomWidthIncrement, height: img.height() + zoomHeightIncrement});
// });

}
});

Flotag.UserView = Ember.View.extend({
	templateName: 'user',
	didInsertElement: function(){
		this.get('controller').send('documentReady');

	},

});

Flotag.PostsView = Ember.View.extend({
	templateName: 'posts-view',

	didInsertElement: function(){
		
	}



});

Flotag.PostView = Ember.View.extend({
	templateName: 'post-view'

});

Flotag.LoadMoreView = Ember.View.extend({
  templateName: 'load-more-view',
  didInsertElement: function() {
    var view = this;
    this.$().bind('inview', function(event, isInView, visiblePartX, visiblePartY) {

      if (isInView) view.get('controller.controllers.posts').send('loadMorePosts');
    });
  }
});


Flotag.TreeBranchView = Ember.View.extend({
  tagName: 'ul',
  templateName: 'tree-branch',
  classNames: ['tree-branch'],
  	didInsertElement: function ()
	{
	    this.$().slideUp(0);
	    this.$().slideDown(250);
	},
});

Flotag.SearchView = Em.View.extend({
	templateName: 'search-view',
	didInsertElement: function ()
	{
		var self = this;
  		Ember.run.next(function(){
  			//

	            	$("#search-input:not(.applied)").addClass('applied').typeahead([
	            		{
	            			  name: "users",
						      valueKey: "name",
						      local: [],

						       remote: {
						      	url: '/api/search?q=%QUERY',
						      	filter : function(parsedResponse){
						      		//
						      		return parsedResponse.models.search.users;
						      	}
						      },
						      engine: T,
							  template: [  
							    '<img  class="search-res" style="margin:0;display:inline-block;vertical-align:middle;" src="/api/profile/{{_id.$oid}}?thumbnail=true" > ', 
							    '<div style="margin:0;display:inline-block;vertical-align:middle;">'                 ,                                       
							    '<p class="repo-name">{{name}}</p>',
							    '<p class="repo-name"><em>{{username}}</em></p>',
							    '</div>'

							                                        
							                             
							  ].join(''),

								header: '<h5 class="">Users</h5>'
						    },
	            		{
	            			name: "tags",
						      valueKey: "name",
						      local: [],
								header: '<h5 class="">Tags</h5>',
						       remote: {
						      	url: '/api/search?q=%QUERY',
						      	filter : function(parsedResponse){
						      		//
						      		return parsedResponse.models.search.tags;
						      	}
						      },
						      engine: T,
							  template: [  
							    '<img  class="search-res" style="margin:0;display:inline-block;vertical-align:middle;" src="/api/profile/{{_id.$oid}}?thumbnail=true" > ', 
							    '<div style="margin:0;display:inline-block;vertical-align:middle;">'                 ,                                       
							    '<p class="repo-name">{{name}}</p>',
							    '</div>'

							                                        
							                             
							  ].join('')


						    },
						    ]).on('typeahead:selected', function (e, d) {
						    	
						 		//that.trigger('tm:popped');
						 		if(d._cls == "Tag.User"){
						 			self.get('controller').transitionTo('user', d._id.$oid);

						 		}
						 		else{
						 			self.get('controller').transitionTo('tag', d._id.$oid);

						 		}
						 		$("#search-input").typeahead('setQuery','');
						 		

					});

            	
        });   
		Ember.run.once(function(){
			
				$(".username-nav").click(function(e) {
					self.get('controller').transitionTo('user', self.get('controller').get('currentUser')._id.$oid);

				});


		});
	}
});

Flotag.PostPostView = Em.View.extend({
	templateName: 'post-post-view',
	data: null,
	previewLoading: false,
	embed: null,
	isImageLink: false,
	isVideoLink: false,
	image: null,
	currRequest: null,


	loadPreview: function() {

	   var value = this.get('content');
	  var escaped = Handlebars.Utils.escapeExpression(value);
	  var expression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/i;
	  var regex = new RegExp(expression);
	  var link = value.match(regex);
	  this.set('isLink',link);
	  this.set("link",link);
	  var that = this;
	  var xhr = this.get('currRequest');
	  if(xhr){
	  	xhr.abort();
	  	this.set('previewLoading',false);
	  }
	  if(link){
	  var link = link[0];
	  value = value.replace(expression,"");
	  if(!link.match(/http:\/\//) &&!link.match(/https:\/\//)){
	  	link = "http://"+ link;
	  }
	  this.set('content',value);
      that.set('cancelLoad',false);

	  this.set('previewLoading',true);
		var req = $.ajax({
			type: "GET",
			url : "/api/media?url="+link,
			//data: JSON.stringify({"args" : data }),
			complete: function(data){
				if(!that.get('cancelLoad')){
					data = JSON.parse(data.responseText);
					if(data.embed){
						that.set('isVideoLink',true);
						that.set('embed',data.embed);

					}
					else if(isImage(link,data)){
						that.set('isImageLink',data.image);
						that.set('image',data.image);


					}
					data.link = link;

					that.set("data",data);
					that.set('previewLoading',false);

				//that.get('view').set('image',data.image);
				}
				else{
					that.set('previewLoading',false);

				}
			},
			dataType: "application/json",
			contentType : "application/json"
		});
		that.set('currRequest',req);
	}
	}.observes('content'),

	didInsertElement: function ()
	{
		var self = this;

        Ember.run.next(function(){
  			//
  				$('.typeahead-post-tags:not(.applied)').tagsManager({
				//		  template: template,
				//		  engine : Handlebars,
				//maxTags : 1,
				prefilled: [],
				CapitalizeFirstLetter : true,
				tagsContainer: ".postTagCont"
				});
            	$(".typeahead-post-tags:not(.applied)").addClass('applied').typeahead({
					      valueKey: "name",
					      local: [],

					      remote: {
					      	url: '/api/tag?q=%QUERY',
					      	filter : function(parsedResponse){
					      		//
					      		return parsedResponse.models.tags;
					      	},
					      	cache: false
					      },
					      footer: '<div class="dropdown-button"><button href="#myModal" role="button" data-toggle="modal" class="btn btn-primary">Create Tag!</button></div>',

					      engine: T,
						  template: [ 
						  // '<img src="/api/profile/{{_id.$oid}}" alt="Smiley face" height="42" width="42" >' ,
						  	'<p class="repo-freq">x{{frequency}}</p>'  ,                                                               
						    '<p class="repo-name">{{name}}</p>',

						                                        
						                             
						  ].join('')

					    }).on('typeahead:selected', function (e, d) {
					    	// 
					    	var tags = self.get('controller').get("postTags");
					    	tags = [];
					    	tags.addObject(d);
					    	$('.typeahead-post-tags').tagsManager("empty");
					      	$('.typeahead-post-tags').tagsManager("pushTag", d);
					      	self.get('controller').set("postTags",tags);
					      	$(".typeahead-post-tags").typeahead('setQuery','');
					 		$(".typeahead-post-tags").typeahead('setHintValue','');
					 		// that.trigger('tm:popped');
				});
            	
        });
		var timer;
		var self = this;
		Ember.run.next(function(){
		$("#postTextArea").keyup(function() {
			    clearTimeout(timer);
		    var ms = 200; // milliseconds
		    var val = this.value;
		    self.set('data',null);
		    self.set('cancelLoad',true);
		    if(self.get('currRequest')){
		    	self.get('currRequest').abort();

		    }
		    timer = setTimeout(function() {
		    	self.set('previewLoading',false);

		        //console.log( "Handler for .keypress() called." );
		        self.set('data',null);
		        self.set('cancelLoad',true);

		        self.set('content',$("#postTextArea").val());
		    }, ms);
		});
		});

	    
	}
});

Flotag.ApplicationView = Em.View.extend({
	didInsertElement: function ()
	{
		this._super();
		this.get('controller').send('jqueryInit');

	    
	}
});

Flotag.CurrentTagView = Em.View.extend({
	templateName: 'current-tag-view',
	didInsertElement: function ()
	{
		
		this.get('controller').send('initCurrentTags');

	    
	}
});

Flotag.CreateTagView = Em.View.extend({
  templateName: 'create-tag-view',
  tagInput: "My New Tag",
  tagAboutInput: "My Tag Description",
  tagImage: null,

  
  	saveTag: function(){
  		var profile_img = null;
  		if(!$('#profile-img').attr('src')){
			 var r=confirm("Are you sure you don't want to use an image?");
			if (r==true)
			  {
			  	
			  }
			else
			  {
			  			showAlert($('#modal-alert'),"No Image Supplied");
  						return;  	
			  }


  		}
  		else{
  			profile_img = $('#profile-img').attr('src').replace(/data:image\/(jpeg|png);base64,/,"");

  		}
  		Flotag.Tag.saveTag(this.get("tagInput"),this.get("tagAboutInput"),profile_img).then(null,function(data){
	  		if(!data.success){
				showAlert($('#alert'),"Invalid Data");

			}
			else{
				showSuccess($('#alert'),"Tag Creation Successful!");
				$('#myModal').modal('hide');
			}
  		});


  	},
  keyDown: function(e) {
  	if(e.keyCode == 13){
    	this.send('saveTag');
	}
  }
  

});



Flotag.MobileNavView = Em.View.extend({
  templateName: 'mobile-nav-view',

  didInsertElement: function(){
  	Em.run.once(function(){
	  	$( ".mobile-btn" ).click(function(e) {
	  		if(!$(this).hasClass("active") ) {
	  			$( ".mobile-btn" ).removeClass("active");
	  			$(".mobile-btn" ).css("background-color","");	
	  			$(".drop-bar-item").addClass("hide");



		  	 	var str = this.id;
		  	 	if(str.length > 0){
		  	 		$(this).addClass("active");

		  	 		$("#drop-bar").removeClass("hide");

		  	 		var t = str.split("mobile-btn-")[1].trim();
		  	 		$.trim(t);
		  	 		$("#drop-bar-"+t).removeClass("hide");
		 			$(this).css("background-color","orange");	
		 			//$(".fixed-nav-page").css("margin-top",($("nav").height()+50)+"px");

		  	 	}


	 		}
	 		else{
		  	 	$("#drop-bar").addClass("hide");
		  	 	$(this).removeClass("active");
		  	 	var str = this.id;
		  	 	if(str.length > 0){
		  	 		var t = str.split("mobile-btn-")[1].trim();
		  	 		$.trim(t);
		  	 		$("#drop-bar-"+t).addClass("hide");
					//$(".fixed-nav-page").css("margin-top","100px");
		  	 	}

		 		// $("#drop-bar-search").addClass("hide");;
		 		$(this).css("background-color","");	
	 		}
		});

  	});

  }
  

});

Flotag.PreviewCompComponent = Em.Component.extend({
  templateName: 'components/preview-comp'

 
  

});



Flotag.EditProfileView = Em.View.extend({
  templateName: 'edit-profile-view',
  editNameInput: null,
  editAboutInput: null,
  tagImage: null,
  



	visibilityChanged: function(){
		
		this.set('editNameInput', this.get('controller').get('currentUser').get('name'));
	    this.set('editAboutInput', this.get('controller').get('currentUser').get('about'));
	    $("#editImgRemove").click();
	}.observes('controller.base.editViewVisible'),

  
  	saveChanges: function(){
  		var profile_img = null;
  		if($('#profile-img').attr('src')){
  			//showAlert($('#edit-modal-alert'),"No Image Supplied");
  			//return;
  			profile_img = $('#profile-img').attr('src').replace(/data:image\/(jpeg|png);base64,/,"");
  			
  		}
  		var name = this.get('editNameInput');
  		var about = this.get('editAboutInput');
  		var self = this;
  		Flotag.User.updateUser(name,about,profile_img).then(null,function(data){
			data = JSON.parse(data.responseText);
			if(!data.success){
				showAlert($('#edit-modal-alert'),"Invalid Data");

			}
			else{
				$('#editModal').modal('hide');
				showSuccess($('#alert'),"Saved Changes");
			}
			self.get('controller.controllers.authenticated').refreshUser().then(null,function(user){
							//possibly update feed
				self.set('controller.base.editViewVisible',false);

				// self.set('editNameInput', self.get('controller').get('currentUser').get('name'));
	   //  		self.set('editAboutInput', self.get('controller').get('currentUser').get('about'));
			});
  		});

  	},

  	hideEditView: function(){
  		Ember.run.later(this,function() {
  			this.set('controller.base.editViewVisible',false);
  // code to be execute within a RunLoop
		},300);
  		
  	},

  keyDown: function(e) {
  	if(e.keyCode == 13){
    	this.send('saveChanges');
	}
  }
  

});

Flotag.EditTagComponent = Ember.Component.extend({
  
  templateName: "components/edit-tag",
  tagAboutInput: null,
  tagImage: null,
  
  updateAbout: function(){
  	this.set('tagAboutInput',this.get('tag').about);
  }.observes("tag.about"),



	visibilityChanged: function(){
		
	   // this.set('editAboutInput', this.get('tag').get('about'));
	   // $("#editImgRemove").click();
	}.observes(''),

  
  	saveTag: function(){
  		var profile_img = null;
  		if($('#profile-img').attr('src')){
  			//showAlert($('#edit-modal-alert'),"No Image Supplied");
  			//return;
  			profile_img = $('#profile-img').attr('src').replace(/data:image\/(jpeg|png);base64,/,"");
  			
  		}
  		var about = this.get('tagAboutInput');
  		var self = this;
  		Flotag.Tag.updateTag(this.get('tag')._id.$oid,about,profile_img).then(null,function(data){
			data = JSON.parse(data.responseText);
			if(!data.success){
				showAlert($('#edit-tag-modal-alert'),"Invalid Data");

			}
			else{
				$('#editTagModal').modal('hide');
				showSuccess($('#tags-manager-alert'),"Saved Changes");
				self.get('base').send("loadOwnerTags");
			}
			// self.get('controller.controllers.application').refreshUser().then(null,function(user){
			// 				//possibly update feed
	
			// });
  		});

  	},

  	hideEditView: function(){
  // 		Ember.run.later(this,function() {
  // 			this.set('controller.base.editViewVisible',false);
  // // code to be execute within a RunLoop
		// },300);
  		
  	},

  keyDown: function(e) {
  	if(e.keyCode == 13){
    	this.send('saveChanges');
	}
  }
  

});

Flotag.ChangePassView = Em.View.extend({
  templateName: 'change-pass-view',
  oldPass : null,
  newPass : null,
  newPassConf : null,
  savePassword: function(){
  		var newPass = this.get('newPass');
  		var newPassConf = this.get('newPassConf');
  		var oldPass = this.get('oldPass');
  		if(!newPass || !newPassConf || !oldPass ){

  			showAlert($('#pw-modal-alert'),"Missing Data");
  			return;
  		}
  		if(newPass != newPassConf){

  			showAlert($('#pw-modal-alert'),"Passwords Dont Match");
  			return;

  		}

  		var self = this;
  		Flotag.User.changePassword(oldPass,newPass).then(null,function(data){
			data = JSON.parse(data.responseText);
			//console.log(JSON.stringify(data));
			if(!data.models.password_change){
				showAlert($('#pw-modal-alert'),"Password could not be changed");
				self.set('newPass','');
				self.set('oldPass','');
				self.set('newPassConf','');

			}
			else{
				showSuccess($('#alert'),"Password Changed Successfully");
				$('#changePassModal').modal('hide');
				self.set('newPass','');
				self.set('oldPass','');
				self.set('newPassConf','');
			}
  		});


  	},
  keyDown: function(e) {
  	if(e.keyCode == 13){
    	this.send('savePassword');
	}
  }
  

});



Flotag.TagsManagerView = Em.View.extend({
  templateName: 'tags-manager-view',
  editTagComponent: null,

  	init: function(){

		var editTagComponent = this.get('editTagComponent');
		var fn = this.get('controller.controllers.base');
		if(!editTagComponent){
			var f= Flotag.EditTagComponent.create({"base": fn}).append();
			this.set('editTagComponent',f);
		}
  	},

  	destroy: function(){
  		this._super();
  		this.get('editTagComponent').destroy();
  	},
	actions: {
		urlClick: function(uid){
			$(".modal-backdrop").remove();
			$("body").removeClass('modal-open');
			$("#followersModal").modal('hide');
	  		document.location = "/#/tag/" +uid;
		},

		editClicked: function(tag){
			var editTagComponent = this.get('editTagComponent');
			editTagComponent.setProperties({"tag":tag});
			console.log(editTagComponent.get('tag'));
			Ember.run.next(function(){
				$("#editTagModal").modal('show');
			});
		}
	}  

});



Flotag.NotificationView = Em.View.extend({
	templateName: 'notification-view',
classNames: ['nhide'],

    didInsertElement: function() {
    		    // this.$().slideUp(0);

		// this.$().slideDown(250);
		this.$().fadeIn();
		//var self = this;
        

    }


});

Flotag.ReplyingView = Ember.View.extend({
	templateName: 'replying-view',
	classNames: ['replying-view'],

	didInsertElement: function ()
	{
	    this.$().slideUp(0);
	    this.$().slideDown(250);
	},

	willDestroyElement: function ()
	{

		    
	    
	    var clone = this.$().clone();
	    this.$().replaceWith(clone);
	    clone.slideUp(250);
	}




});

Flotag.ReplyView = Ember.View.extend({
	templateName: 'reply-view',
	classNames: ['reply-view'],

	init: function(){
		
		//debugger;
	},

	didInsertElement: function ()
	{
	    
	}




});

Flotag.TreeNodeView = Ember.View.extend({
  tagName: 'li',
  templateName: 'tree-node',
  classNames: ['tree-node']

});

Flotag.HoverTagComponent = Ember.Component.extend({
	templateName: 'components/hover-tag',
	classNames: ['hover-view'],
	mouseinHover: false,

    mouseEnter: function(evt) {
    	// var self = this;
    	// this.set('isVisible',true);
    	this.set('mouseinHover',true);
    },

    mouseLeave: function(event) {
    	Ember.run.later(this,function(){
			this.set('isVisible',false);
			this.set('disabled',true);
    	},25);
    	this.set('mouseinHover',false);


    },


	url: function(){
		if(this.get("tag") && this.get("tag").get("_cls") == "Tag.User"){
			return "/#/user/"+this.get("tag")._id.$oid.toString();

		}
		else if(this.get("tag") && this.get("tag").get("_cls") != "Tag.User"){
			return "/#/tag/"+this.get("tag")._id.$oid.toString();

		}
		else{
			//console.log(this.get('tag'));
		}
	}.property("tag._id.$oid"),

	imgUrl: function(){
		if(this.get('tag')){
					return "/api/profile/"+this.get("tag")._id.$oid.toString();

		}
	}.property('tag._id.$oid')
});



Flotag.TagCompComponent = Ember.Component.extend({
	templateName: 'tag-comp',
	classNames: ['tm-tag','clickable'],
	classNameBindings: ["is_user:tm-tag-info:tm-tag-success",'untagged:tm-tag-warning',"isnt_poster::hidden"],
	tagName:'span',

 
	init : function(){
		var self = this;
		this._super();
			Ember.run.next(function(){
			if(!self.get('isDestroyed')){
			var tag = self.get('tag');
			if(!tag.tag){
				tag.tag = tag._id;
			}
			if(tag.tag.$oid){
				//We should keep a tag dictionary
				//console.log(tag.tag.$oid,tagDict);
				if(tagDict[tag.tag.$oid]){
							var length = tagCompDict[self.get('tag').tag.$oid].length,
							    element = null;

							for (var i = 0; i < length; i++) {
							  element = tagCompDict[self.get('tag').tag.$oid][i];
							  element.propertyDidChange('tagDetailed');
							  // Do something with element i.
							}
					//self.set('tagDetailed',tagDict[tag.tag.$oid]);
				}
				else{
					tagQueue.push(tag.tag.$oid);


				}
				if(!tagDict[tag.tag.$oid]){
					tagDict[tag.tag.$oid] = tag;

				}
				if(!tagCompDict[self.get('tag').tag.$oid]){
					tagCompDict[self.get('tag').tag.$oid] = [self];
				}
				else{
					tagCompDict[self.get('tag').tag.$oid].push(self);				

				}


			}
		}
		});

	},

	tagDetailed: function(){
		var self = this;
		var tag = self.get('tag');
		if(!tag.tag){
			tag.tag = tag._id;
		}
		return tagDict[this.get("tag").tag.$oid];
	}.property(),

	click: function(){
		document.location = this.get('url');		
	},


    mouseEnter: function(evt) {
    	var self = this;
		self.set('mouseInside',true);
    	Ember.run.later(this,function(){
    		if(self.get('mouseInside')){
    			// Flotag.Tag.find(this.get('tag').tag.$oid).then(null,function(tag){


    			// });
    			//handleTag(self,evt,this.get('tagDetailed'));

    		}
    	},500);
    },

    mouseLeave: function(event) {
    	var self = this;
    	self.set('mouseInside',false);
    	if(self.get('hoverComp') && !this.get('hoverComp').get('mouseinHover')){
	    	Ember.run.later(this,function(){
	    		if(!self.get('hoverComp').get('mouseinHover')){
					self.get('hoverComp').set('isVisible',false);
					self.get('hoverComp').set('disabled',true);
				}
	    	},500);
		}

    },
	

	is_user: function(){

		if(this.get('tagDetailed')){
			return this.get('tagDetailed')._cls == "Tag.User";

		}
		return false;
	}.property('tagDetailed._cls'),

	isnt_poster: function(){
		

		if(!this.get('poster')){
			return true;
		}
		if(!this.get('poster').$oid){
			this.get('poster').$oid = this.get('poster')._id.$oid;
		}
		
		return this.get('tag').tag.$oid != this.get('poster').$oid;
	}.property("poster.$oid"),




	untagged: function(){

		var inArray = false;
		var user = this.get('user');
		var tag = this.get('tag');
		if(tag._id == null && tag.tag != null){
			tag._id = tag.tag;

		}
		if(!tag._id){
			return true;
		}
		if(!user){
			return true;
		}
	    $.each(user.default_tags, function( index, obj ) {
	        if(obj.$oid == tag._id.$oid){
	          inArray = true;
	          //console.log(obj);
	          return;

	        }
	    });
	    //console.log(!inArray);
	    return !(inArray);

	}.property('tag._id.$oid','user.default_tags'),

	url: function(){
		if(this.get("tagDetailed")){
		if(this.get("tagDetailed") && this.get("tagDetailed")._cls == "Tag.User"){
			return "/#/user/"+this.get("tagDetailed")._id.$oid.toString();

		}
		else if(this.get("tagDetailed") && this.get("tagDetailed")._cls != "Tag.User"){
			if(!this.get("tagDetailed")._id){
				return "";
			}
			//console.log(JSON.stringify(this.get("tagDetailed")));
			return "/#/tag/"+this.get("tagDetailed")._id.$oid.toString();

		}
		else{
			//console.log(this.get('tag'));
		}
	}
	else{
		if(this.get('tag').$oid){
			return "/#/tag/"+this.get("tag").$oid;

		}
		else if(this.get('tag')._id){
			return "/#/tag/"+this.get("tag")._id.$oid;

		}
	}
	}.property("tagDetailed._id.$oid"),

	imgUrl: function(){
		return "/api/profile/"+this.get("tag")._id.$oid.toString()+"?thumbnail=true";
	}.property('tag._id.$oid')
});

Flotag.FollowerComponent = Ember.Component.extend({
	templateName: 'follower-comp',
	

});

Flotag.UserListViewComponent = Ember.Component.extend({
	actions: {
		urlClick: function(uid){
			$(".modal-backdrop").remove();
			$("body").removeClass('modal-open');
			$("#followersModal").modal('hide');
	  		document.location = "/#/user/" +uid;
		}
	}
	// imgUrl: function(){

	// 	return "/api/profile/"+this.get("_id").$oid.toString();
	// }.property('_id.$oid')

});



//Flotag.register('controller:treeNode', Flotag.TreeNodeController, {singleton: false});



/**************************
* Controllers
**************************/



Flotag.BaseController = Ember.ObjectController.extend(Ember.Evented,{

	needs: ['application','authenticated'],
	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	authenticated: Ember.computed.alias("controllers.authenticated"),

	sort : "erank",
	showNotifications: false,
	searchLoaded: false,
	unreadNots: false,
	currTags: [],
	ownerTags: [],
	notifications: [],
	editViewVisible: false,
	followers: [],


	reset: function(){
		this.set('showNotifications',false);
		this.set('searchLoaded',false);
		this.set('unreadNots',false);
		this.set('currTags',[]);
		this.set('ownerTags',[]);
		this.set('notifications',[]);
		this.set('editViewVisible',false);
		this.set('followers',[]);
		this.set('model',null);
	},

	userProfileUrl: function(){

		return "/api/profile/"+this.get("user").$oid.toString();
	},

  	toggleEditView: function(){

  		this.set('editViewVisible',true);
  	},

  	loadFollowers: function(uid){
  		var self = this;
		Flotag.User.getFollowers(uid).then(null,function(followers){
			self.set('followers',followers);

		});
	},

  	loadOwnerTags: function(uid){
  		var self = this;
		Flotag.User.getOwnerTags().then(null,function(ownedTags){
			self.set('ownerTags',ownedTags);
		});
	}


});

function processTags(){
	setTimeout(processTags,2000);
	if(tagQueue.length > 0){
	Flotag.Tag.getTags(JSON.stringify(tagQueue)).then(null,function(tags){
				console.log(tags);
				//self.set('tagDetailed',ntag);
				tags.forEach(function(ntag){

					tagDict[ntag._id.$oid] = ntag;
					var length = tagCompDict[ntag._id.$oid].length,
					    element = null;

					for (var i = 0; i < length; i++) {
					  element = tagCompDict[ntag._id.$oid][i];
					  element.propertyDidChange('tagDetailed');
					  // Do something with element i.
					}
				});

				//console.log(tagDict);
			

		});
	tagQueue = [];
}
}


Flotag.IndexController = Ember.ArrayController.extend({
	needs: ['application','authenticated','base' ,'posts','index'],
	base: Ember.computed.alias("controllers.base"),
	index: Ember.computed.alias("controllers.index"),
	application: Ember.computed.alias("controllers.application"),
	authenticated: Ember.computed.alias("controllers.authenticated"),


  	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	posts : Ember.computed.alias("controllers.posts"),
	sort: Ember.computed.alias("controllers.posts.sort"),
	page : Ember.computed.alias("controllers.posts.page"),
	canLoadMore : Ember.computed.alias("controllers.posts.canLoadMore"),
	currTags: Ember.computed.alias("controllers.base.currTags"),
	ownedTags: Ember.computed.alias("controllers.base.ownedTags"),
	postTags: Ember.computed.alias("controllers.posts.postTags"),
	notifications: Ember.computed.alias("controllers.base.notifications"),
	trendingTime: 24,
	trendingTags: null,

	init: function(){
		this._super();
		this.addObserver('currTags.isLoaded', this, function(){
			this.send('initCurrentTags');
		});
		
	},
	reset: function(){
		$("#post-tags").tagsManager("empty");
		$("#current-tags").tagsManager("empty");
		this.set('trendingTime',24);
		this.set('trendingTags',null);
		this.set('model',null);

	},

	actions: {

	  	pushCurrentTag: function(tagAdded){
	  		var self = this;
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tagAdded){
	  			return;
	  		}
			this.get('application').set('isLoading',true);
			currTags.addObject(tagAdded);
			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.updateTags(currTags).then(this,function(data){
	  			Flotag.Post.getFeed(self.get('sort'),1,null).then(null,function(feed){
	  				self.set('posts.model', feed);
	  				self.set('page',1);
					self.set('canLoadMore', true);
													   		$("#currentTagCont").popover("hide");
										$("#randBtn").popover("hide");
						self.controllerFor('authenticated').refreshUser().then(null,function(user){
							//possibly update feed
							self.get('application').set('isLoading',false);
						});
	  			});
				

	  		});


	  	},

	  	pushRandomTags: function(nresults){
	  		var excludes = [];
	  		this.get('currTags').forEach(function(tag){
	  			excludes.push(tag._id);
	  		});
	  		var self = this;
	  		Flotag.Tag.getRandom(JSON.stringify(excludes),nresults).then(null,function(tags){
								   		$("#currentTagCont").popover("hide");
										$("#randBtn").popover("hide");
	  			tags.forEach(function(tag){
	  				$("#current-tags").tagsManager("pushTag", tag);
	  				//self.pushCurrentTag(tag);
	  			});
	  			if(tags.length == 0){
	  				showSuccess($('#alert'),"Can you believe it?? Youve added all the Tags in our database!");
	  			}
	  		});
	  	},



	  	removeCurrentTag: function(tags){		

	  		var self = this;
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tags || currTags.length <= 0){
	  			return;
	  		}
			var indexToRemove = -1;
			var tagBeingRemoved = tags[0];
			$.each(currTags, function( index, value ) {
				if(value._id.$oid == tagBeingRemoved._id.$oid){
					indexToRemove = index;
				}
		  		
			});
			console.log(indexToRemove,tagBeingRemoved);

			this.get('application').set('isLoading',true);
			currTags.splice(indexToRemove,1);
			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.removeTags(tags).then(this,function(data){
	  			Flotag.Post.getFeed(self.get('sort'),1,null).then(null,function(feed){
	  				self.set('posts.model', feed);
					self.set('page',1);
					self.set('canLoadMore', true);

						self.controllerFor('authenticated').refreshUser().then(null,function(user){
							//possibly update feed
							self.get('application').set('isLoading',false);
						});
	  			});

	  		});
	  		
	  	},



	  	initCurrentTags: function(){

	  			var self = this;
		  		Ember.run.once(function(){
		  			
			  			if(self.get('currTags').get('isLoaded') && $('#current-tags')){
			  				
			  				$('#current-tags:not(.applied)').tagsManager({
								prefilled: self.get('currTags'),
								CapitalizeFirstLetter : true,
								tagsContainer: "#currentTagCont",
							});
			            	$("#current-tags:not(.applied)").addClass('applied').typeahead({
								      valueKey: "name",
								      local: [],

								       remote: {
								      	url: '/api/tag?q=%QUERY',
								      	filter : function(parsedResponse){
								      		//
								      		return parsedResponse.models.tags;
								      	},
								      	 cache: false
								      },
								      footer: '<div class="dropdown-button"><button href="#myModal" role="button" data-toggle="modal" class="btn btn-primary">Create Tag!</button></div>',
								      engine: T,
									  template: [  
									  	'<p class="repo-freq">x{{frequency}}</p>'  ,   
									  	'<p class="repo-name"><em>{{username}}</em></p>',
                                                            
									    '<p class="repo-name">{{name}}</p>',


									                                        
									                             
									  ].join('')


								    }).on('typeahead:selected', function (e, d) {
								    	// var tags = that.get("currTags");
								    	// tags.addObject(d);
								   		$("#currentTagCont").popover("hide");
										$("#randBtn").popover("hide");

								      	$("#current-tags").tagsManager("pushTag", d);
								 		$("#current-tags").typeahead('setQuery','');
								 		$("#current-tags").typeahead('setHintValue','');


							});

							//check if empty give them some default tags
							if(self.get('currTags').length == 0){
								
								$("#currentTagCont").popover("show");
								$("#randBtn").popover("show");

							}
						}
		            	
						$('#currentTagCont .tm-tag').hover(

							function(e){
								
								var tag=$('#current-tags').tagsManager('getTag',e.target.id);
								if(tag){
									//handleTag(self,e,tag);
										
								}		
								//console.log('this',$( this ));
							},
							function(e){
								//self.get('hoverComp').set('isVisible',false);
								//this.get('hoverComp').set('disabled',true);
							}
						);
		            	
		        });
			
	  	}.observes('currTags.isLoaded'),
		readAllNotifications: function(){
			var self = this;
		    this.get('index').set('unreadNots',false);
		    this.get('index').set('showNotifications',!this.get('index').get('showNotifications'));

			Flotag.User.readAllNotifications().then(null,function(){

			});
		},


	},





	computedRead: function(){
			var unread = 0;
			var nots = this.get('notifications');
			var that = this;
			nots.forEach(function(not){
				if(!not.read){
					console.log(unread);
					unread += 1;
				}   	

	        });

	        if(unread > 0){
	        	this.get('index').set('unreadNots',true);
	        }
	        if(unread==20){
	        	return "20+";
	        }
	        return unread;
	}.property("notifications.@each"),

	updateTrends: function(){
		var self = this;
		if(this.get('trendingTime')){
			if(this.get('trendingTime') > 0){
				Flotag.Tag.getTrending(this.get('trendingTime')).then(null,function(tags){
					if(tags.length == 0){
						self.set('trendingTags',[]);
					}
					else{
						self.set('trendingTags',tags);

					}
				});	
			}
			else{
				this.set('trendingTime',24);
			}		
		}
		else{
			if(!Flotag.get('isEditing')){
				this.set('trendingTime',24);

			}
			//this.updateTrends();
		}

	}.observes("trendingTime","Flotag.isEditing")
});
  Flotag.InlineTextField = Ember.TextField.extend({
    focusOut: function() {
      Flotag.set('isEditing', false);
    },

	  keyDown: function(e) {
	  	if(e.keyCode == 13){
	    	 Flotag.set('isEditing', false);
		}
	  }
  });

  Flotag.TextView = Ember.View.extend({
  	tagName: "span",
    doubleClick: function() {
      Flotag.set('isEditing', true);
    }
  });

function handleTag(self,e,tag){
	var hoverComponent = self.get('hoverComp');
	if(!hoverComponent){
		hoverComponent = Flotag.HoverTagComponent.create({tag:tag});
		hoverComponent.append();
		if(!hoverComponent.get('isDestroyed')){
			hoverComponent.set('isVisible',false);
		}
		Ember.run.next(function(){
			if(!hoverComponent.get('isDestroyed')){

				hoverComponent.set('isVisible',true);
				var p = $("#"+e.target.id);
				var offset = p.offset();
				var half = $(window).height()/2;
				if(offset){
					if(offset.top - $(window).scrollTop() < half){
						$("#"+hoverComponent.elementId).offset({ top: e.pageY +25,  left: offset.left});
						$("#"+hoverComponent.elementId).hide().fadeIn();
					}
					else{
						$("#"+hoverComponent.elementId).offset({ top: e.pageY - $("#"+hoverComponent.elementId).height() - p.height() - 25 , left: offset.left});
						$("#"+hoverComponent.elementId).hide().fadeIn();
					}
				}
			}
		});
		self.set('hoverComp',hoverComponent);

		return;
	}
	else{
		if(!hoverComponent.get('isDestroyed')){

			hoverComponent.set('tag',tag);
			hoverComponent.set('isVisible',true);
		}
	}
	var p = $("#"+e.target.id);
	var offset = p.offset();
	var half = $(window).height()/2;
	if(offset){
		if(offset.top - $(window).scrollTop() < half){
			$("#"+hoverComponent.elementId).offset({ top: e.pageY + 25 , left: offset.left});
			$("#"+hoverComponent.elementId).hide().fadeIn();
		}
		else{
			$("#"+hoverComponent.elementId).offset({ top: e.pageY - $("#"+hoverComponent.elementId).height() - p.height() - 25 , left: offset.left});
			$("#"+hoverComponent.elementId).hide().fadeIn();
		}
	}
}


Flotag.PostsController =  Ember.ArrayController.extend({

  	needs: ['application','authenticated','base' ,'posts'],
  	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	application: Ember.computed.alias("controllers.application"),
	authenticated: Ember.computed.alias("controllers.authenticated"),

    itemController: 'post',
    feedTags: null,
    page: 1,
    isLoading: false,
    canLoadMore: true,
    sort: "erank",

    reset: function(){

    	this.set('feedTags',null);
    	this.set('page',1);
    	this.set('isLoading',false);
    	this.set('canLoadMore',true);
    	this.set('sort',"erank");
    	this.set('model',[]);


    },


    
	actions: {


		post: function(obj){
			var self = this;
			var tags = this.get("postTags");
			if(!tags || tags.length <= 0){
				showAlert($('#post-modal-alert'),"Need to use an existing tag or create your own.");
				return;
			}
			this.get('application').set('isLoading',true);
			if(tags && tags.length > 0){
				var tag = tags[0];

				var text = $("#postTextArea").val();
				
				if(text && text.length > 0){

					Flotag.Post.post(text,[tag]).then(null,function(data){
						self.controllerFor('authenticated').refreshUser().then(null,function(user){
							//possibly update feed
							$("#current-tags").tagsManager("pushTag", tag);
							data = JSON.parse(data.responseText);
							if(!data.success){
								showAlert($('#post-modal-alert'),"Invalid Data");

							}
							else{
								showSuccess($('#alert'),"Post Successful!");
							}
							self.get('application').set('isLoading',false);
						});
					});
				}
			}
			else{
				showAlert($('#alert'),"Invalid Data");
				return;
			}
			
			$("#post-tags").tagsManager("empty");

			$("#postTextArea").val('');
			$("#postTextArea").keyup();
			$("#post-tags").typeahead('setQuery','');
			this.set("postTags",[]);
			$("#post-tags").typeahead('setQuery','');
			$('#postpostModal').modal('hide');
			//this.set('currentUser',Flotag.User.getCurrentUser(false));
			//this.set('content', Flotag.Post.getFeed(this.get('currentUser'),this.get('sort'),1,this.get('feedTags')));
		},




		sort: function(sortby){
			var self = this;
			this.set('sort',sortby);
			this.set('page',1);
			this.set('canLoadMore',true);
			$("#ajax-loader").show();
			this.set('isLoading',true);
			this.get('application').set('isLoading',true);

			console.log(sortby,1,this.get('feedTags'));
	  		var feedTags =this.get('feedTags'); 
	  		if(feedTags){
	  			feedTags = JSON.stringify(feedTags);
	  		}

			Flotag.Post.getFeed(sortby,1,feedTags).then(null,function(feed){
				self.set('content',feed);
				$("#ajax-loader").hide();
				self.set('isLoading',false);
				self.get('application').set('isLoading',false);


			});
		},

	  	loadMorePosts: function(){
	  		//check if feed loaded
	  		if(this.get('canLoadMore') && !this.get('isLoading')){
		  		this.set('isLoading',true);

		  		$("#ajax-loader").show();

		  		var feedTags =this.get('feedTags'); 
		  		if(feedTags){
		  			feedTags = JSON.stringify(feedTags);
		  		}
		  		//debugger;
		  		var self = this;
		  		this.get('application').set('isLoading',true);
		  		Flotag.Post.getFeed(self.get('sort'),this.get('page')+1,feedTags).then(null,function(nfeed){
		  			var currentPosts = self.get('content');

		  			currentPosts.addObjects(nfeed);
					self.set('page',self.get('page')+1);
		  			self.set('isLoading',false);
		  			$("#ajax-loader").hide();
		  			if(nfeed.length <= 0){
		  				self.set('canLoadMore',false);
		  			}
		  			self.get('application').set('isLoading',false);
		  		});

	  		}

	  	},





	},




	computedFeed: function(){
		var feed = this.get('model');
		var curr_user = this.get('currentUser');
		if(feed && curr_user){
			feed.forEach(function(post){
	 
	                	
	        	if(curr_user.voteDict[post._id.$oid]){
	            	if(curr_user.voteDict[post._id.$oid].state > 0){
	            		post.set('upvoted',true);
	            	}
	            	else if(curr_user.voteDict[post._id.$oid].state < 0){
	            		post.set('downvoted',true);
	            	}
	            	else{
	            		post.set('downvoted',false);
	            		post.set('upvoted',false);
	            	}
	        	}
	                	


	        });
		}
	}.observes('model.@each','currentUser.votes'),



  	filterFeed: function(){
  		
  		Flotag.User.updateTags(this.get("currTags"));

  		this.set('content', Flotag.Post.getFeed(this.get('currentUser'),this.get('sort'),1,null));
  	}.on("currentTagsUpdated"),

	// processTags: function(){
	// 	if(this.get('model').length > 0){
	// 		console.log(this.get('model'));

	// 	}
	// }.observes("model.@each")



});

Flotag.PostController = Ember.ObjectController.extend({

  	needs: ['application','authenticated'],
  	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	application: Ember.computed.alias("controllers.application"),
	authenticated: Ember.computed.alias("controllers.authenticated"),

	isReplying: false,
	repliesHidden: true,
	repliesLoading: false,
	repliesLoaded: false,
	previewHidden: false,
	canLoadMoreReplies: true,
    page: 1,
    sort: "rank",
    nresults: 30,
    totalLoaded: 0,

    reset: function(){
    	this.set('isReplying',false);
    	this.set('repliesHidden',true);
    	this.set('repliesLoaded',false);
    	this.set('repliesLoading',false);
    	this.set('previewHidden',false);
    	this.set('canLoadMoreReplies',true);
    	this.set('page',1);
    	this.set('sort',"rank");
    	this.set('nresults',30);
    	this.set('totalLoaded',0);
    },

	actions: {
			toggleReplying: function(){
				this.set('isReplying',!this.get('isReplying'));

			},

			preview: function(){	
		      this.set('previewHidden',!this.get('previewHidden'));
			},

			toggleReplies: function(){
				this.set('repliesLoaded',false);
				var curr_user = this.get('currentUser');
				var self = this;
				self.get('application').set('isLoading',true);
				self.set('page',1);
				self.set('canLoadMoreReplies',true);

				this.get('content').getReplies(this.get('page'),this.get('totalLoaded')+this.get('nresults'),this.get('sort')).then(null,function(replies){
					self.set('replies',replies);
					self.set('repliesLoaded',true);
					self.get('application').set('isLoading',false);

					self.set('totalLoaded',replies.length);
					self.set('page',parseInt(replies.length/self.get('nresults'))+1);

				});
				
				this.set('repliesHidden',!this.get('repliesHidden'));
			},

		  upvote: function() {
		  	var user = this.get('currentUser');
		  	var post = this.get('content');
		  	Flotag.Post.vote(post,1);
		  	this.lazyVote(1);
		  	
		  },

		  downvote:function(){
		  	var user = this.get('currentUser');
		  	var post = this.get('content');
		  	Flotag.Post.vote(post,-1);
		  	this.lazyVote(-1);
		  },

		  reply: function(){



		  	var self = this;
		  	var user = this.get('currentUser');
		  	var replyText = this.get('replyText');
		  	var post = this.get('content');
			self.get('application').set('isLoading',true);

			post.set('repliesLoaded',false);
		  	Flotag.Reply.reply(post,null,replyText).then(null,function(data){
		  		post.set('reply_count',post.get('reply_count')+1);

				self.controllerFor('authenticated').refreshUser().then(null,function(user){
							//possibly update feed
					post.getReplies(1,self.get('totalLoaded'),self.get('sort')).then(null,function(replies){
						self.set('replies',replies);
						self.set('totalLoaded',replies.length);
						post.set('repliesLoaded',true);
						self.get('application').set('isLoading',false);

					});	
				});

		  	});
		  	this.set('replyText','');
		  	this.set('isReplying',false);

		  },
	  	loadMoreReplies: function(){
	  		//check if feed loaded
	  		if(this.get('canLoadMoreReplies') && !this.get('repliesLoading')){
	  			var curr_user = this.get('currentUser');
				var self = this;
				self.set('repliesLoading',true);
				this.get('content').getReplies(this.get('page')+1,this.get('nresults'),this.get('sort')).then(null,function(reps){
					var currReplies = self.get('replies');
					currReplies.addObjects(reps);
					self.set('replies',currReplies);
					self.set('repliesLoading',false);
					self.set('page',self.get('page')+1);
					self.set('totalLoaded',currReplies.length);

		  			if(reps.length <= 0){
		  				self.set('canLoadMoreReplies',false);
		  			}
				});

	  		}

	  	},
	},

	computedReplies: function(){

		var replies = this.get('replies');
		var curr_user = this.get('currentUser');
		if(replies && curr_user){
			replies.forEach(function(reply){
	 
	                	
	        	if(curr_user.voteDict[reply.id.$oid]){
	            	if(curr_user.voteDict[reply.id.$oid].state > 0){
	            		reply.set('upvoted',true);
	            	}
	            	else if(curr_user.voteDict[reply.id.$oid].state < 0){
	            		reply.set('downvoted',true);
	            	}
	            	else{
	            		reply.set('downvoted',false);
	            		reply.set('upvoted',false);
	            	}
	        	}
	                	


	        });
		}
	}.observes('replies.@each','currentUser.votes'),

	lazyVote: function(istate){
					var id = this.get('_id.$oid');
					var user = this.get('currentUser');
					if(!user.voteDict[id]){

						user.voteDict[id] = { state : 0};

					}
					if(istate == 1){
						if(user.voteDict[id].state == -1){
							this.set('downvoted',false);
							this.set('upvoted',false);
							this.set('downvotes',this.get('downvotes') - 1); 
							user.voteDict[id].state = 0;
							//post.set('upvotes',0); 
							
						}
						else if(user.voteDict[id].state == 0){
							this.set('upvoted',true);
							this.set('downvoted',false);

							this.set('upvotes',this.get('upvotes') + 1); 
							user.voteDict[id].state =  1;
						}
					}
					else{
						if(user.voteDict[id].state == 1){
							this.set('upvoted',false);
							this.set('downvoted',false);
							this.set('upvotes',this.get('upvotes') - 1); 
							user.voteDict[id].state = 0;
						}
						else if(user.voteDict[id].state == 0){
							this.set('downvoted',true);
							this.set('upvoted',false);

							this.set('downvotes',this.get('downvotes') + 1); 
							user.voteDict[id].state = -1;

							//debugger;
						}
					}
	},

	userProfileImage: function() {
		//
		if(!this.get('user')._id){
			return "";
		}
        return "/api/profile/"+ this.get('user')._id.$oid+"?thumbnail=true";
    }.property('user._id.$oid')


});


Flotag.UserController = Em.ObjectController.extend({
	needs: ['application','authenticated','base' ,'posts','index'],
	index: Ember.computed.alias("controllers.index"),

	application: Ember.computed.alias("controllers.application"),
	authenticated: Ember.computed.alias("controllers.authenticated"),

	base: Ember.computed.alias("controllers.base"),
  	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	currTags: Ember.computed.alias("controllers.base.currTags"),
	posts: Ember.computed.alias("controllers.posts"),
	notifications: Ember.computed.alias("controllers.base.notifications"),

	
	documentReady: function(){

	},

	reset: function(){
		this.set('content',null);
		this.set('model',null);
	},



	checkUserTagged: function(){

		if(this.get('currentUser') && this.get('_id')){

			this.get('content').set('userTagged',idInArray(this.get('currentUser').default_tags,this.get('_id').$oid));
		}
	}.observes('_id.$oid','currentUser.default_tags'),

	actions: {
		post: function(obj){
			var self = this;
			var tag = this.get("content");
			if(tag){
				

				var text = $("#postTextArea").val();
				if(text && text.length > 0){
					self.get('application').set('isLoading',true);

					Flotag.Post.post(text,[tag]).then(null,function(data){
						self.get('authenticated').refreshUser().then(null,function(user){
										//possibly update feed
							
							Flotag.Post.getFeed("erank",1,JSON.stringify([tag.get('_id')])).then(null,function(feed){
								self.get('posts').set('model',feed);
								self.get('posts').set('page',1);
								self.get('posts').set('canLoadMore',true);
							    self.get('application').set('isLoading',false);

							});
				
						});
					});
				}
			}
			else{
				showAlert($('#alert'),"Invalid Data");
				return;
			}
			$("#postTextArea").val('');
			//$("#post-tags").typeahead('setHintValue','');


		},
		tagUser: function(){
	  		var self = this;
	  		var tagAdded = this.get('content');
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tagAdded){
	  			return;
	  		}
			self.get('application').set('isLoading',true);

			currTags.addObject(tagAdded);
			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.updateTags(currTags).then(this,function(data){
	  			self.get('model').incrementProperty('frequency');
				self.get('authenticated').refreshUser().then(null,function(user){
								//possibly update feed
							self.get('application').set('isLoading',false);

				});
	  		});


		},

		untagUser: function(){
			//this.controllerFor('posts').set('currTags',this.get('content').get('currTags'));
	  		var self = this;
	  		var tagRemoved = this.get('content');
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tagRemoved || currTags.length <= 0){
	  			return;
	  		}
			var indexToRemove = -1;
			$.each(currTags, function( index, value ) {
				if(value._id.$oid === tagRemoved._id.$oid){
					indexToRemove = index;
				}
		  		
			});
			currTags.splice(indexToRemove,1);
					self.get('application').set('isLoading',true);

			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.removeTags([tagRemoved]).then(this,function(data){
		  		self.get('model').decrementProperty('frequency');

				self.get('authenticated').refreshUser().then(null,function(user){
								//possibly update feed
							self.get('application').set('isLoading',false);

				});
	  		});
		}

	}


});



Flotag.TagController = Em.ObjectController.extend({
	needs: ['application','authenticated','base' ,'posts','index'],
	application: Ember.computed.alias("controllers.application"),
	index: Ember.computed.alias("controllers.index"),
	authenticated: Ember.computed.alias("controllers.authenticated"),

	base: Ember.computed.alias("controllers.base"),
  	currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
	currTags: Ember.computed.alias("controllers.base.currTags"),
	posts: Ember.computed.alias("controllers.posts"),
	notifications: Ember.computed.alias("controllers.base.notifications"),

	
	documentReady: function(){

	},

	reset: function(){
		this.set('content',null);
		this.set('model',null);
	},

	checkUserTagged: function(){

		if(this.get('currentUser') && this.get('_id')){

			this.get('content').set('userTagged',idInArray(this.get('currentUser').default_tags,this.get('_id').$oid));
		}
	}.observes('_id.$oid','currentUser.default_tags'),

	actions: {
		post: function(obj){
			var self = this;
			var tag = this.get("content");
			if(tag){
				

				var text = $("#postTextArea").val();
				if(text && text.length > 0){
					self.get('application').set('isLoading',true);

					Flotag.Post.post(text,[tag]).then(null,function(data){
						self.get('authenticated').refreshUser().then(null,function(user){
										//possibly update feed
							
							Flotag.Post.getFeed("erank",1,JSON.stringify([tag.get('_id')])).then(null,function(feed){
								self.get('posts').set('model',feed);
								self.get('posts').set('page',1);
								self.get('posts').set('canLoadMore',true);
								self.get('application').set('isLoading',false);

							});
				
						});
					});
				}
			}
			else{
				showAlert($('#alert'),"Invalid Data");
				return;
			}
			$("#postTextArea").val('');
			//$("#post-tags").typeahead('setHintValue','');


		},
		tagUser: function(){
	  		var self = this;
	  		var tagAdded = this.get('content');
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tagAdded){
	  			return;
	  		}
			self.get('application').set('isLoading',true);

			currTags.addObject(tagAdded);
			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.updateTags(currTags).then(this,function(data){
	  			self.get('model').incrementProperty('frequency');

				self.get('authenticated').refreshUser().then(null,function(user){
								//possibly update feed
							self.get('application').set('isLoading',false);

				});
	  		});


		},

		untagUser: function(){
			//this.controllerFor('posts').set('currTags',this.get('content').get('currTags'));
	  		var self = this;
	  		var tagRemoved = this.get('content');
	  		var currTags = this.get('currTags');

	  		if(!currTags || !tagRemoved || currTags.length <= 0){
	  			return;
	  		}
			var indexToRemove = -1;
			$.each(currTags, function( index, value ) {
				if(value._id.$oid === tagRemoved._id.$oid){
					indexToRemove = index;
				}
		  		
			});
			currTags.splice(indexToRemove,1);
			self.get('application').set('isLoading',true);

			this.propertyWillChange('currTags');
			this.set('currTags',currTags);
			this.propertyDidChange('currTags');
	  		Flotag.User.removeTags([tagRemoved]).then(this,function(data){
	  			self.get('model').decrementProperty('frequency');

				self.get('authenticated').refreshUser().then(null,function(user){
								//possibly update feed
							self.get('application').set('isLoading',false);

				});
	  		});
		}
	}

});



Flotag.LoginController = Ember.Controller.extend({

  needs: ['application','authenticated'],
  application: Ember.computed.alias("controllers.application"),
  authenticated: Ember.computed.alias("controllers.authenticated"),



	reset: function(){
		this.setProperties({
			username : "",
			password : ""
		});
		//this.get('application').set('isLoading',false);

	},
	
	loggedIn: localStorage.loggedIn,
	
	loggedInChanged: function(){
		localStorage.loggedIn = this.get('loggedIn');
	}.observes('loggedIn'),
	
	login : function(){
 		var self = this, data = this.getProperties('username', 'password');
		
		
		self.get('application').set('isLoading',true);

		$.ajax({
			type: "POST",
			url : "/api/auth/login",
			data: JSON.stringify({"args" : data }),
			complete: function(data, textStatus, jqXHR){
				self.get('application').set('isLoading',false);
				if(data.status != 200){
					if(data.responseText){
						data = JSON.parse(data.responseText);
						if(data.args['Error'] && data.args['Error'] == 1){
							showAlert($('#alert'),"You Must Verify your email first");

						}
						else{
							showAlert($('#alert'),"Login failed");

						}
					}
					else{
						showAlert($('#alert'),"Login failed");

					}

				}
				else{
					self.set('loggedIn',true);
					var attemptedTransition = self.get('attemptedTransition');
					self.get('authenticated').refreshUser().then(null,function(user){

					});
					if(attemptedTransition){
						attemptedTransition.retry();
						self.set('attemptedTransition',null);
					}
					else{
						
						self.transitionToRoute('index');
					}
					
				}
			},
			dataType: "application/json",
			contentType : "application/json"
		});
	}
});
Flotag.TreeBranchController = Ember.ObjectController.extend({
});


Flotag.TreeNodeController = Ember.ObjectController.extend({
  needs: ['application','authenticated'],
	application: Ember.computed.alias("controllers.application"),
  authenticated: Ember.computed.alias("controllers.authenticated"),

  currentUser: Ember.computed.alias("controllers.authenticated.currentUser"),
  isExpanded: true,

  isReplying: false,

  replyText: '',
  actions : {
	  toggleReplying: function(){
		this.set('isReplying',!this.get('isReplying'));
	  },

	  toggle: function() {
	    // set all other nodes isExpanded = false
	    //this.toggleProperty('isExpanded');
	    this.set('isExpanded',!this.get('isExpanded'));
	// set current node isExpanded = true
	  },

	  upvote: function() {
	  	var user = this.get('currentUser');
	  	var post = this.get('post');
	  	var reply = this.get('content');
	  	Flotag.Post.vote(post,1,reply);
	  	this.send('lazyVote',1);
	  	
	  },

	  downvote:function(){
	  	var user = this.get('currentUser');
	  	var post = this.get('post');
	  	var reply = this.get('content');
	  	Flotag.Post.vote(post,-1,reply);
	  	this.send('lazyVote',-1);
	  },

	  reply: function(){
	  	var self = this;
	  	var user = this.get('currentUser');
	  	var replyText = this.get('replyText');
	  	var reply = this.get('content');
	  	var post = this.get('post');
		post.set('repliesLoaded',false);
	  	Flotag.Reply.reply(post,reply,replyText).then(null,function(data){
	  			post.set('reply_count',post.get('reply_count')+1);

				self.controllerFor('authenticated').refreshUser().then(null,function(user){
							//possibly update feed
					post.getReplies().then(null,function(replies){
						post.set('replies',replies);
						post.set('repliesLoaded',true);
					});	
			});
	  	});
	  	this.set('replyText','');
	  	this.set('isReplying',false);


	  },
		lazyVote: function(istate){
					var id = this.get('content').get('id.$oid');
					var user = this.get('currentUser');
					if(!user.voteDict[id]){

						user.voteDict[id] = { state : 0};

					}
					if(istate == 1){
						if(user.voteDict[id].state == -1){
							this.set('downvoted',false);
							this.set('upvoted',false);
							this.set('downvotes',this.get('downvotes') - 1); 
							user.voteDict[id].state = 0;
							//post.set('upvotes',0); 
							
						}
						else if(user.voteDict[id].state == 0){
							this.set('upvoted',true);
							this.set('downvoted',false);

							this.set('upvotes',this.get('upvotes') + 1); 
							user.voteDict[id].state =  1;
						}
					}
					else{
						if(user.voteDict[id].state == 1){
							this.set('upvoted',false);
							this.set('downvoted',false);
							this.set('upvotes',this.get('upvotes') - 1); 
							user.voteDict[id].state = 0;
						}
						else if(user.voteDict[id].state == 0){
							this.set('downvoted',true);
							this.set('upvoted',false);

							this.set('downvotes',this.get('downvotes') + 1); 
							user.voteDict[id].state = -1;

							//debugger;
						}
					}
		},
  }





});

function showAlert($elem,message){

	$elem.css("background-color","red");
	$elem.find('h4').html(message);
	$elem.fadeIn();
    setTimeout(function(){
        //$('#alert').fadeOut();
        $elem.fadeOut();
    }, 5000);
}

function showInfo($elem,message){
	$elem.css("background-color","blue");
	$elem.find('h4').html(message);
	$elem.fadeIn();
    setTimeout(function(){
        //$('#alert').fadeOut();
        $elem.fadeOut();
    }, 5000);
}

function showSuccess($elem,message){
	$elem.css("background-color","green");
	$elem.css("color","white");
	$elem.find('h4').html(message);
	$elem.fadeIn();
    setTimeout(function(){
        $elem.fadeOut();
    }, 5000);
}

function register($form){
	var challenge = Recaptcha.get_challenge();
	var captcha_resp = Recaptcha.get_response();
	Recaptcha.reload();
	var name = $('#inputName').val();
	var username = $('#inputUsername').val();
	var email = $('#inputEmail').val();
	var password = $('#inputPass').val();
	var confPassword = $('#inputConfPass').val();
	var about = $('#textAbout').val();
	var file_input = $('#profile_img');
	if(!$('#profile-img').attr('src')){
		showAlert($('#alert'),"No Image Supplied");
		return;	
	}
	var profile_img = $('#profile-img').attr('src').replace(/data:image\/(jpeg|png);base64,/,"");
	if(confPassword != password){
		showAlert($('#alert'),"Passwords don't match");
		return;
	}

	var data = JSON.parse(JSON.stringify(
		{"models" : {
			"user": {
					"name":name,
					"username": username,
					"email" : email,
					"about" : about,
					"password" : password
					},
					'recaptcha': {
						'challenge' : challenge,
						'response' : captcha_resp
					},
					"profile_img" : profile_img}}));
	
	$('#ajax-loader').show();
	$('#ajax-loader_nav').show();
	$.ajax({
		type: "POST",
		url : "/api/user",
		data: JSON.stringify(data),
		complete: function(data, textStatus, jqXHR){
			$('#ajax-loader').hide();	
			$('#ajax-loader_nav').hide();

			if(data.status == 500){
				showAlert($('#alert'),"Oops, Something Went Wrong");
				return;
	
			}
			data = JSON.parse(data.responseText);
			
			if(!data.success){
				if(data.args.Error && data.args.Error ==  1){
					showAlert($('#alert'),"Incorrect Captcha");
				}
				else if(data.args.Error && data.args.Error ==  2){
					showAlert($('#alert'),"Username already exists");
				}
				else if(data.args.Error && data.args.Error ==  3){
					showAlert($('#alert'),"Email already exists");
				}

				else{
					showAlert($('#alert'),"Invalid Data");

				}


			}
			else{
				alert("Registration Successful! A confirmation url has been sent to your email");
				document.location = "/";
			}
		},
		dataType: "application/json",
		contentType : "application/json"
	});
}



$(document).ready(function() {

	
// 	$('input.typeahead-post-tags').typeahead({
// 		  name: 'post-tags',
// 		  local: ['c++','python','java','ruby'],
// //		  template: template,
// //		  engine : Handlebars,
// 		  prefilled: [],
// 		  CapitalizeFirstLetter : true,
// 		  maxTags: 1,
// 		});

	// $('#login-form').submit(function() {
	// 	  login($(this));
	// 	  return false;
	// });

	$('#register-form').submit(function() {
		  register($(this));
		  return false;
	});
	loginBack();
	$('#alert').hide();

});

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();


function loginBack() {

    var i, j, canvas, context, points = [], width, height, numLines = 6;
    width = $(window).width();
    height = $(window).height();
    $("#curves").height(height);
    $("#curves").width(width);   
    $("#canvas").height(height);
    $("#canvas").width(width);   
    canvas = $("#canvas")[0];
   	if(!canvas){
   		return;
   	}
    context = canvas.getContext("2d");
    canvas.width = $(window).width();;
    canvas.height = $(window).height();;
    width = canvas.width;
    height = canvas.height;
    var time;


    
    context.lineWidth = 0.1;
    var Color = "0F82F5";
    var life = Math.random() * (10000 -5000) + 5000;
    var timepassed = 0;
    for(i = 0; i < 4 * numLines; i += 1) {
        points.push({x:Math.random() * width, y:Math.random() * height, vx:Math.random() * 4 - 2, vy:Math.random() * 4 - 2,lifetime:Math.random() * 10000});
    }
    
    
    function draw() {
        //requestAnimationFrame(draw);
        // Drawing code goes here
        setTimeout(function() {
            requestAnimFrame(draw);
            // Drawing code goes here
            for(j = 0; j < numLines; j += 1) {
                context.beginPath();
                context.moveTo(points[j * 4].x, points[j * 4].y);
                context.bezierCurveTo(points[j * 4 + 1].x, points[j * 4 + 1].y,
                                      points[j * 4 + 2].x, points[j * 4 + 2].y,
                                      points[j * 4 + 3].x, points[j * 4 + 3].y);
                context.strokeStyle = Color;
                if(timepassed > life){
                    context.strokeStyle = "#87CEFA";

                }
                else{
                    context.strokeStyle = "#0F82F5";

                }
                context.stroke();
            }

    	        for(i = 0; i < points.length; i += 1) {
    	            		points[i].y += points[i].vx;
    	            		points[i].x += points[i].vy;
    	          }

    	       if(timepassed > 15000){
    	    	   $("#canvas").fadeOut({
    	    		   duration: 800,
    	    		   done: function() {
    	    			   context.clearRect(0, 0, canvas.width, canvas.height);
    	    			   $("#canvas").fadeIn({
    	    				   done: function(){
    	    				        for(i = 0; i < points.length; i += 1) {
    		    		            		points[i].y = Math.random() * $(window).height();
    		    		            		points[i].x = Math.random() * $(window).width();
    		    		            		points[i].vx = Math.random() * 4 - 2;
    		    		            		points[i].vy = Math.random() * 4 - 2;

    	    				        }	
    		    		            	    $("#curves").height($(window).height());
    		    		            	    $("#curves").width($(window).width());   
    		    		            	    $("canvas").height($(window).height());
    		    		            	    $("canvas").width($(window).width());   
    	    				   }
    	    			   });
    				        timepassed = 0;

    	    		   }
    	    		   
    	    	   });
    	    	   

    	       }

            timepassed += (1000/35);
        }, 1000 / 35);

    }
    draw();

};
// Ember.Handlebars.registerHelper('getLink', function (value, options) {
// 	  var escaped = Handlebars.Utils.escapeExpression(value);
// 	  var expression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
// 	  var regex = new RegExp(expression);
// 	  return value.match(regex);

// });

Handlebars.registerHelper("debug", function(optionalValue) {
  
  
  
 
  if (optionalValue) {
    
    
    
  }
});

function idInArray(array,value){
	var inArray = false;
    //console.log("val",array,value);

    $.each(array, function( index, obj ) {
        if(obj.$oid === value){
          inArray = true;
          //console.log(obj);
          return;

        }
    });
    if(inArray){
    	return true;

    }
    else{
    	return false;

    }
}

 Ember.Handlebars.registerBoundHelper('idNotInArray', function(array, value, options) {
    var inArray = false;
    //console.log("val",array,value);

    $.each(array, function( index, obj ) {
        if(obj.$oid === value){
          inArray = true;
          //console.log(obj);
          return;

        }
    });
    if(inArray){
    	return options.inverse(this);

    }
    else{
    	return options.fn(this);

    }

    	
    
  });



Ember.Handlebars.helper('sub', function(context, options){
    return context - parseFloat(options);
});



function isImage(url,data){
	if(data['content-type']){
	if(data['content-type'].indexOf("image") != -1 ||(data.image && data.image.indexOf("livememe") != -1)){
	return true;
	}
	}
	return false;
}
String.prototype.capitalize = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
};
