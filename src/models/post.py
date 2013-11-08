from mongoengine import *
import datetime
from bson.objectid import ObjectId
import util.ranking

class Post(Document):
    meta = {'allow_inheritance': True}
    user = ReferenceField('User',dbref=False)
    tags = ListField(EmbeddedDocumentField('EmbeddedTag'))
    content = StringField(max_length=1100)
    upvotes = IntField(default=1)
    downvotes = IntField(default=0)
    rank = FloatField(default=0)
    replies = ListField(EmbeddedDocumentField('Reply'),default=[])
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)

class Reply(EmbeddedDocument):
    id = ObjectIdField(default=ObjectId)
    user = ReferenceField('User',dbref=False)
    username = StringField()
    parent = ObjectIdField()
    content = StringField(max_length=1100)
    upvotes = IntField(default=1)
    downvotes = IntField(default=0)
    rank = FloatField(default=0)
    date_created = DateTimeField(default=datetime.datetime.utcnow)
    date_modified = DateTimeField(default=datetime.datetime.utcnow)

class SponsoredPost(Post):
    cost = FloatField()
    probability = FloatField()

class EmbeddedTag(EmbeddedDocument):
    tag = ReferenceField('Tag',dbref=False)
    name = StringField(max_length=25)
    is_user = BooleanField(default=False)