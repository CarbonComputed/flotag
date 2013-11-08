import json

class ReceiveModel(object):
    """docstring for ClassName"""
    def __init__(self, success=True,args=None,models=None):
        super(ReceiveModel, self).__init__()
        self.args = args
        self.models = models
        if models == None:
            self.models = {}
        self.models = models
    
    def __repr__(self):
            return json.dumps(self.__dict__)