from handlers.base import BaseHandler,RestHandler
from handlers.user import UserActions
from handlers.post import PostActions
from models.response import ResponseModel
from models.user import User,Vote
from models.profile_image import ProfileImage
from util.MongoEncoder import *
import util.ranking
import logging

from tornado import gen
import tornado.web
from mongoengine import *

logger = logging.getLogger(__name__)


class VoteHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self):
        response = ResponseModel()
        try:
            
            vote_model = self.get_json_model("vote")
            state = vote_model['state']
            post_id = vote_model['post_id']
            user = yield gen.Task(UserActions._get_me_by_id,self.current_uid())
            post = yield gen.Task(PostActions._get_post_by_id,post_id)
            reply_id = vote_model.get('reply_id',None)
            vote = None
            if reply_id == None:
                if state == 1:
                    vote = yield gen.Task(VoteActions._upvote_post,user, post, state)
                elif state == -1:
                    vote = yield gen.Task(VoteActions._downvote_post,user, post, state)
            else:
                    replies =filter(lambda x: x.id == ObjectId(reply_id), post.replies)
                    if len(replies) != 1:
                        raise Exception("There can only be one!!")
                    reply = replies[0]
                    if state == 1:
                        vote = yield gen.Task(VoteActions._upvote_reply,user, post,reply, state)
                    elif state == -1:
                        vote = yield gen.Task(VoteActions._downvote_reply,user, post, reply,state)
            
            response.model = vote
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
    
    
class VoteActions:
        
        
        @staticmethod
        def _upvote_post(user,post,state,callback=None):
            votes = filter(lambda x: x.post_id == post.id, user.votes)
            if len(votes) > 1:
                raise Exception("There can only be one or 0 in this case :)!!")
            if len(votes) == 0:
                vote = Vote(state=0,post_id=post.id)
                user.votes.append(vote)


            else:
                vote = votes[0]
            
            if vote.state == -1:
                vote.state = 0
                post.update(dec__downvotes=1)
                post.user.update(inc__reputation=2)
            elif vote.state == 0:
                vote.state = 1
                post.update(inc__upvotes=1)
                post.user.update(inc__reputation=2)
            elif vote.state == 1:
                raise Exception("User has already upvoted this post")
            post.save()
            post.reload()
            post.rank = util.ranking.hot(post.upvotes,post.downvotes,post.date_created)
            print post.upvotes,post.downvotes,post.date_created

            post.save()
            user.save()
            if callback != None:
                return callback(vote)
            return vote
        
        @staticmethod
        def _downvote_post(user,post,state,callback=None):
            votes = filter(lambda x: x.post_id == post.id, user.votes)
            if len(votes) > 1:
                raise Exception("There can only be one!!")
            if len(votes) == 0:
                vote = Vote(state=0,post_id=post.id)
                user.votes.append(vote)
            else:
                vote = votes[0]
            if vote.state == -1:
                raise Exception("User has already downvoted this post")
            elif vote.state == 0:
                vote.state = -1
                post.update(inc__downvotes=1)
                post.user.update(dec__reputation=2)
            elif vote.state == 1:
                vote.state = 0
                post.update(dec__upvotes=1)
                post.user.update(dec__reputation=2)
            print post.upvotes,post.downvotes,post.date_created
            post.save()
            post.reload()
            post.rank = util.ranking.hot(post.upvotes,post.downvotes,post.date_created)
            post.save()
            user.save()
            if callback != None:
                return callback(vote)
            return vote
           
        @staticmethod
        def _upvote_reply(user,post,reply,state,callback=None):
            votes = filter(lambda x: x.post_id == reply.id, user.votes)
            if len(votes) > 1:
                raise Exception("There can only be one or 0 in this case :)!!")
            if len(votes) == 0:
                vote = Vote(state=0,post_id=reply.id)
                user.votes.append(vote)

            else:
                vote = votes[0]
            
            if vote.state == -1:
                vote.state = 0
                reply.downvotes -= 1
                reply.user.update(inc__reputation=2)
            elif vote.state == 0:
                vote.state = 1
                reply.upvotes += 1
                reply.user.update(inc__reputation=2)
            elif vote.state == 1:
                raise Exception("User has already upvoted this post")
            reply.rank = util.ranking.confidence(post.upvotes,post.downvotes)
            post.save()
            user.save()
            if callback != None:
                return callback(vote)
            return vote
        
        @staticmethod
        def _downvote_reply(user,post,reply,state,callback=None):
            votes = filter(lambda x: x.post_id == reply.id, user.votes)
            if len(votes) > 1:
                raise Exception("There can only be one!!")
            if len(votes) == 0:
                vote = Vote(state=0,post_id=reply.id)
                user.votes.append(vote)
            else:
                vote = votes[0]
            if vote.state == -1:
                raise Exception("User has already downvoted this post")
            elif vote.state == 0:
                vote.state = -1
                reply.downvotes += 1
                reply.user.update(dec__reputation=2)
            elif vote.state == 1:
                vote.state = 0
                reply.upvotes -=1
                reply.user.update(dec__reputation=2)
            reply.rank = util.ranking.confidence(post.upvotes,post.downvotes)
            post.save()
            user.save()
            if callback != None:
                return callback(vote)
            return vote


        def _vote_reply(self,user,post,reply_id,state,callback=None):
            pass