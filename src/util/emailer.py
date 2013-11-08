import logging
import datetime

from mailer import Mailer
from mailer import Message

logger = logging.getLogger(__name__)

def verify_email(user):
#     logger.debug("Generated email verification link: " + user.reg_id)
#     if not user.active:
    message = Message(From="me@flotag.com",To="kmcarbone16@gmail.com",charset="utf-8")
    message.Subject = "Flotag Email Verification"
    message.Html = """This email uses <strong>Complete Flotag Registration</strong>!"""
    message.Body = """Flotag Registration"""
    
    sender = Mailer('127.0.0.1')
    sender.send(message)

def password_email(user):
    pass

def info_email(user):
    pass

def info_broadcast_email():
    pass

def password_change_email(user):
    pass

verify_email(None)