import handlers.user
import handlers.tag
import handlers.post
import handlers.profile_image
import handlers.reply
import handlers.media
import handlers.vote

url_patterns = [
                (r"/api/user/default_tags",handlers.user.UserDefaultTagHandler),

                (r"/api/user/?(^.{0,23}$)?",handlers.user.UserHandlerByName),
                (r"/api/user/?([0-9a-fA-F]{24})?",handlers.user.UserHandlerById),
                (r"/api/user/me",handlers.user.UserMeHandler),
                (r"/api/user/?([0-9a-fA-F]{24})?/default_tags",handlers.user.UserDefaultTagHandler),
                (r"/api/user/?([0-9a-fA-F]{24})?/followers",handlers.user.UserFollowerHandler),
                (r"/api/tag/?([0-9a-fA-F]{24})?",handlers.tag.TagHandler),
                (r"/api/tag/trending",handlers.tag.TrendingTagHandler),
                (r"/api/tag/owner",handlers.tag.OwnerTagHandler),
                (r"/api/tag/random",handlers.tag.RandomTagHandler),
                (r"/api/post/?([0-9a-fA-F]{24})?",handlers.post.PostHandler),
                (r"/api/post/([0-9a-fA-F]{24})/reply/?([0-9a-fA-F]{24})?",handlers.reply.ReplyHandler),
                (r"/api/profile/?([0-9a-fA-F]{24})?",handlers.profile_image.ProfileImageHandler),
                (r"/api/media/?",handlers.media.MediaHandler),
                (r"/api/vote/?",handlers.vote.VoteHandler),
                (r"/api/nots/?",handlers.user.NotificationHandler),
                (r"/api/nots/read/?([0-9a-fA-F]{24})?/?",handlers.user.ReadNotificationHandler),
                (r"/api/auth/login",handlers.auth.LoginHandler),
                (r"/api/auth/twitter",handlers.auth.TwitterLoginHandler),
                (r"/api/auth/logout",handlers.auth.LogoutHandler),
                (r'/api/unauthorized',handlers.base.UnauthorizedHandler),
                (r'/api/search',handlers.search.SearchHandler),
                (r'/api/password',handlers.auth.PasswordChangeHandler),
                (r'/api/verify/?',handlers.auth.EmailConfirmHandler),
                (r'/api/auth/check',handlers.user.CheckLoginHandler)
                
                              
]