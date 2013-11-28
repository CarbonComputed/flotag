import memcache
from hashlib import md5

memoizecache = memcache.Client(['127.0.0.1:11211'], debug=1)

def memoize(iden, time = 0, stale=False, timeout=30):
    def memoize_fn(fn):
        
        def new_fn(*a, **kw):

            #if the keyword param _update == True, the cache will be
            #overwritten no matter what
            update = kw.pop('_update', False)
            key = make_key(iden, *a, **kw)
            res = None if update else memoizecache.get(key)
            if res is None:
                # not cached, we should calculate it.
#                 with make_lock("memoize", 'memoize_lock(%s)' % key,
#                                time=timeout, timeout=timeout):

                    # see if it was completed while we were waiting
                    # for the lock
#                     stored = None if update else memoizecache.get(key)
#                     if stored is not None:
#                         # it was calculated while we were waiting
#                         res = stored
#                     else:
                        # okay now go and actually calculate it
                    res = fn(*a, **kw)
                    memoizecache.set(key, res, time=time)


            
            return res

        new_fn.memoized_fn = fn
        return new_fn
    return memoize_fn

def make_key(iden, *a, **kw):
    """
    A helper function for making memcached-usable cache keys out of
    arbitrary arguments. Hashes the arguments but leaves the `iden'
    human-readable
    """
    h = md5()

    def _conv(s):
        if isinstance(s, str):
            return s
        elif isinstance(s, unicode):
            return s.encode('utf-8')
        elif isinstance(s, (tuple, list)):
            return ','.join(_conv(x) for x in s)
        elif isinstance(s, dict):
            return ','.join('%s:%s' % (_conv(k), _conv(v))
                            for (k, v) in sorted(s.iteritems()))
        else:
            return str(s)

    iden = _conv(iden)
    h.update(iden)
    h.update(_conv(a))
    h.update(_conv(kw))

    return '%s(%s)' % (iden, h.hexdigest())

@memoize('test')
def test(x, y):
    import time
    time.sleep(5)
    print 'calculating %d + %d' % (x, y)
    if x + y == 10:
        return None
    else:
        return x + y

