from mongoengine import *
from models.tag import *
import datetime
from bson.objectid import ObjectId

EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
USER_REGEX = r'^.{0,150}$'

class User(Tag):
    meta = {
        'indexes': [
            { 'fields': ['username'], 'unique': True,
              'sparse': True, 'types': False },
            { 'fields': ['email'], 'unique': True,
              'sparse': True, 'types': False },
        ],
    }
    email = EmailField(regex = EMAIL_REGEX,required = True)
    username = StringField(regex=USER_REGEX,required = True)
    current_tags = ListField(ObjectIdField())
    default_tags = ListField(ObjectIdField())
    reputation = IntField(default = 0)
    votes = ListField(EmbeddedDocumentField('Vote'))
    messages = ListField(EmbeddedDocumentField('Message'))
    notifications = ListField(EmbeddedDocumentField('Notification'))
    password = StringField(required = True)
    salt = StringField(required = True)
    active = BooleanField(default=False)
    reg_id = ObjectIdField(default=ObjectId)
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)

class Notification(EmbeddedDocument):
    meta = {'allow_inheritance': True}
    message = StringField(max_length = 400)
    id = ObjectIdField(default=ObjectId)
    read = BooleanField(default = False)
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)
    
class TagNotification(Notification):
    user = ReferenceField('User')
    
class Vote(EmbeddedDocument):
    post_id = ObjectIdField()
    state = IntField(min_value=-1, max_value=1)

class Message(EmbeddedDocument):
    id = ObjectIdField(default=ObjectId)
    user = ReferenceField('User')
    content = StringField(max_length=10000)
    read = BooleanField(default=False)
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)



#     
#     @staticmethod
#     def fb_register(fb_user,email,callback=None):
#         user = User()
#         profile_image = ProfileImage()
#         profile_image.Image = urllib.urlretrieve(fb_user['picture']['data']['url'])
#         user.Name = fb_user['name']
#         user.Gender = fb_user['gender']
#         school = School()
#         school.Name = fb_user['education'][-1]['school']['name']
#         school.Major = fb_user['education'][-1]['school']['concentration']
#         school.GradYear = fb_user['education'][-1]['school']['year']
#         work = Work()
#         work.Company = fb_user['work'][0]['employer']
#         work.Position = fb_user['work'][0]['position']
#         work.Location = fb_user['work'][0]['location']['name']
#         user.School = School
#         user.Work = work
#         user.Email = email
#         user.PrivateData.RegId =  ObjectId()
#         user.save()
#         profile_image.Owner = user.id
#         profile_image.save()
#         user.ProfileImg = profile_image.id
#         print user.__dict__
#         if callback != None:
#             return callback(user)
#         return user
# 
# 
#     @staticmethod
#     def post(user,callback=None):
#         password = user['PrivateData']["Password"]
#         m = hashlib.md5()
#         m.update(password)
#         password = m.hexdigest()
#         user['PrivateData']['Password'] = password
#         user['PrivateData']['RegId'] = ObjectId()
#         usermodel = User.from_json(json.dumps(user,default=json_util.default))
#         usermodel.save()
#         if callback != None:
#             return callback(usermodel)
#         return usermodel
# 
#     @staticmethod
#     def put(user,callback=None):
#         password = user['PrivateData'].get("Password","").strip()
#         if password != None and password != "":
#             m = hashlib.md5()
#             m.update(password)
#             password = m.hexdigest()
#             user['PrivateData']['Password'] = password
#         new_usermodel = User.from_json(json.dumps(user,default=json_util.default))
#         old_usermodel = User.objects(id=new_usermodel.id).first()
#         print old_usermodel.id
#         if password != None and password != "":
#             old_usermodel.PrivateData.Password = new_usermodel.PrivateData.Password
# 
#         if new_usermodel.Gender != None:
#             old_usermodel.Gender = new_usermodel.Gender
#         if new_usermodel.Name != None:
#             old_usermodel.Name = new_usermodel.Name
#         if new_usermodel.About != None:
#             old_usermodel.About = new_usermodel.About
#         if new_usermodel.School != None:
#             if new_usermodel.School.GradYear != None:
#                 old_usermodel.School.GradYear = new_usermodel.School.GradYear
#             if new_usermodel.School.Major != None:
#                 old_usermodel.School.Major = new_usermodel.School.Major
#         old_usermodel.date_modified = datetime.datetime.utcnow()
#         old_usermodel.save()
#         if callback != None:
#             return callback(old_usermodel)
#         return old_usermodel
# 
#     @staticmethod
#     def login(cred,password,callback=None):
#         m = hashlib.md5()
#         m.update(password)
#         password = m.hexdigest()
#         user = User.objects(Email=cred,PrivateData__Password=password).first()
#         if callback != None:
#             return callback(user.id)
#         return user.id
#     
#     @staticmethod
#     def nots(current_user,page=1,sort=None,callback=None):
# 
#         user = User.objects(id=current_user).first()
#         n = (page-1) * NRESULTS
#         nnr = n + NRESULTS
#         if callback != None:
#             return callback(user.PrivateData.Nots[n:nnr])
#         return user.PrivateData.Nots[n:nnr]
#     

        