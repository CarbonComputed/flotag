from Queue import Queue
from threading import Thread

class asynchronous(object):
    def __init__(self, func):
        self.func = func

        def threaded(*args, **kwargs):
            self.queue.put(self.func(*args, **kwargs))

        self.threaded = threaded

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)

    def start(self, *args, **kwargs):
        self.queue = Queue()
        thread = Thread(target=self.threaded, args=args, kwargs=kwargs);
        thread.start();
        return asynchronous.Result(self.queue, thread)

    class NotYetDoneException(Exception):
        def __init__(self, message):
            self.message = message

    class Result(object):
        def __init__(self, queue, thread):
            self.queue = queue
            self.thread = thread

        def is_done(self):
            return not self.thread.is_alive()

        def get_result(self):
            if not self.is_done():
                raise asynchronous.NotYetDoneException('the call has not yet completed its task')

            if not hasattr(self, 'result'):
                self.result = self.queue.get()

            return self.result
        
# import time
# from functools import update_wrapper
# import redis
# 
# class RateLimit(object):
#     expiration_window = 10
# 
#     def __init__(self, key_prefix, limit, per, send_x_headers):
#         self.reset = (int(time.time()) // per) * per + per
#         self.key = key_prefix + str(self.reset)
#         self.limit = limit
#         self.per = per
#         self.send_x_headers = send_x_headers
#         p = redis.pipeline()
#         p.incr(self.key)
#         p.expireat(self.key, self.reset + self.expiration_window)
#         self.current = min(p.execute()[0], limit)
# 
#     remaining = property(lambda x: x.limit - x.current)
#     over_limit = property(lambda x: x.current >= x.limit)
# 
# def get_view_rate_limit():
#     pass
# #return tornado ratelimit
# #     return getattr(g, '_view_rate_limit', None)
# 
# def on_over_limit(limit):
#     return 'You hit the rate limit', 400
# 
# def ratelimit(limit, per=300, send_x_headers=True,
#               over_limit=on_over_limit,
#               scope_func=lambda: self.request.remote_addr,
#               key_func=lambda: self.request.endpoint):
#     def decorator(f):
#         def rate_limited(*args, **kwargs):
#             key = 'rate-limit/%s/%s/' % (key_func(), scope_func())
#             rlimit = RateLimit(key, limit, per, send_x_headers)
#             #set tornado ratelimit
# #             g._view_rate_limit = rlimit
#             if over_limit is not None and rlimit.over_limit:
#                 return over_limit(rlimit)
#             return f(*args, **kwargs)
#         return update_wrapper(rate_limited, f)
#     return decorator
