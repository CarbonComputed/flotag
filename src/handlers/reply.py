from handlers.base import RestHandler
from handlers.user import *
from models.response import ResponseModel
from models.post import *
from util.MongoEncoder import *
from util.decorators import *

from tornado import gen
import tornado.web

import util.ranking

from models.post import *

class ReplyHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,post_id,reply_id):
        response = ResponseModel()

        try:
            sort = self.get_argument("sort", default=None, strip=True)
            nresults = int(self.get_argument("nresults", default=300, strip=True))
            page = int(self.get_argument("page", default=1, strip=True))
        except Exception, e:
            response.success = False
            response.args['Message'] = "Error parsing arguments"
            logger.error(e)
            self.write_json(response)
            return  
        try:
#             user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['replies'] = yield gen.Task(ReplyActions._get_replies,post_id,sort,nresults,page)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,post_id,reply_id):
        response = ResponseModel()
        try:
            reply_model = self.get_json_model("reply")
            
            content = reply_model['content']
            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['reply'] = yield gen.Task(ReplyActions._create_reply,user, post_id,content,reply_id)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine 
    def put(self,post_id,reply_id):
        response = ResponseModel()
        try:
            if post_id == None or reply_id == None:
                raise Exception("You need a postId and replyId for this action")
            reply_model = self.get_json_model("reply")
            
            content = reply_model['content']
            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['reply'] = yield gen.Task(ReplyActions._update_reply,user, post_id,content,reply_id)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine 
    def delete(self,post_id,reply_id):            
            
        response = ResponseModel()
        try:
            if post_id == None or reply_id == None:
                raise Exception("You need a postId and replyId for this action")
            reply_model = self.get_json_model("reply")
            
            content = reply_model['content']
            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['reply'] = yield gen.Task(ReplyActions._update_reply,user, post_id,content,reply_id)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
    

class ReplyActions:
    
    @staticmethod
    def _update_reply(user,post_id,new_content,reply_id,callback=None):
        post = Post.objects(id=post_id).first()
        replies =filter(lambda x: x.id == ObjectId(reply_id), post.replies)
        if len(replies) != 1:
            raise Exception("There can only be one!!")
        if replies[0].user.id != user.id:
            raise Exception("Thats not your reply")
        replies[0].content = new_content
        post.save()
        if callback != None:
            return callback(replies[0])
        return replies[0]
    
    @staticmethod
    def _get_reply(user,post_id,reply_id,content,callback=None):
        reply = Post.objects(id=post_id,replies__S__id=reply_id).first()
        if callback != None:
            return callback(reply)
        return reply
    

    @staticmethod
    @asynchronous
    def _get_replies(post_id,sort=None,nresults=300,page=1,callback=None):
        replies = Post.objects(id=post_id).first().replies
        if sort == "new":
            replies = sorted(replies,key=lambda reply:reply.date_created,reverse=True)
        else:
            replies = sorted(replies,key=lambda reply:reply.rank,reverse=True)
        start = ((page-1) * nresults)
        end = (((page-1) * nresults)+nresults)
        replies = replies[start:end]
        if callback != None:
            return callback(replies)
        return replies
    
    @staticmethod
    def _create_reply(user,post_id,content,parent_id=None,callback=None):
        if parent_id == None:
            parent_id = post_id
        reply = Reply(parent=parent_id,content=content,user=user)
        reply.rank = util.ranking.confidence(1, 0)
        reply.username = user.username
        Post.objects(id=post_id).first().update(push__replies=reply)
        user.reload()
        user.votes.append(Vote(post_id=reply.id,state=1))
        user.save()
        if callback != None:
            return callback(reply)
        return reply

    @staticmethod
    def _delete_reply(user,post_id,reply_id,callback=None):
        post = Post.objects(id=post_id).first()
        replies = filter(lambda x: x.id == ObjectId(reply_id), post.replies)
        if len(replies) != 1:
            raise Exception("There can only be one!!")
        if replies[0].user.id != user.id:
            raise Exception("Thats not your reply")
        replies[0].content = "[reply deleted]"
        post.save()
        if callback != None:
            return callback(replies[0])
        return replies[0]