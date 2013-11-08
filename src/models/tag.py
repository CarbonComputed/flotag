from mongoengine import *
import datetime

class Tag(DynamicDocument):
    meta = {'allow_inheritance': True}
    name = StringField(max_length=25)
    about = StringField(max_length=200)
    profile_img = ReferenceField('ProfileImage',dbref=False)
    frequency = IntField(default=0)
    owner = ReferenceField('User',dbref=False)
    related = ListField(ReferenceField('Tag',dbref=False))
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)