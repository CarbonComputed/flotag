from util import MongoEncoder

class ResponseModel(object):
    """docstring for ClassName"""
    def __init__(self, success=True,args=None,model=None):
        
        super(ResponseModel, self).__init__()
        self.success = success
        self.args = args
        self.model = model
        if args == None:
            self.args = {}
        if model == None:
            self.model = {}
        
    
    def __repr__(self):
            if self.model == None:
                self.model = "null"
       
            json = """ {"success" : %s ,"args" : %s, "models" : %s }"""\
                % (MongoEncoder.dumps(self.success),MongoEncoder.dumps(self.args),MongoEncoder.dumps(self.model))
            return json
        

