from mongoengine import *

class ProfileImage(Document):
    owner = ObjectIdField()
    image = ImageField(collection_name="images",thumbnail_size=(50,50,True))
