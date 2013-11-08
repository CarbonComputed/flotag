import smtplib

from email.mime.text import MIMEText

def send_confirmation(email,uniqueid):
    msg = MIMEText("""
Welcome to Flotag!  Your online registration is almost complete. To validate your account please click: 
        http://www.flotag.com/#/verify/%s
Thank you for signing up.

Sincerely,
-- 
Kevin Carbone

    """ % uniqueid)
    msg['Subject'] = 'Flotag Conirmation'
    msg['From'] = 'noreply@flotag.com'
    msg['To'] = email
    smtp = smtplib.SMTP('localhost',timeout=7)
    # smtp.ehlo()
    # smtp.starttls()
    # smtp.ehlo
    # print 'test1'
    smtp.sendmail('nobody@ubicell.com', [email], msg.as_string())
    # print 'test'
    smtp.quit()