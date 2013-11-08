# Copyright (c) 2009 by Jeff Weisberg
# Author: Jeff Weisberg
# Created: 2009-Jun-25 13:18 (EDT)
# Function: python solvemedia interface
#
# $Id$

import urllib
import urllib2
import sha


# solvemedia servers:

ADCOPY_API_HTTP			= "http://api.solvemedia.com"
ADCOPY_API_HTTPS		= "https://api-secure.solvemedia.com"
ADCOPY_VERIFY_HTTP		= "http://verify.solvemedia.com/papi/verify"
ADCOPY_SIGNUP_HTTP		= "http://api.solvemedia.com/public/signup"

# create solvemedia object:
#   c = libsolvemedia.Solvemedia( ckey, vkey, hkey )
#     ckey	- your solvemedia api ckey
#     vkey 	- your solvemedia api vkey
#     hkey	- your solvemedia api hkey
#
# c.get_html( errorp, usessl )
#   get html for the solvemedia widget
#     errorp	- display an error message on the widget
#     usessl	- use ssl
#
# c.check_answer( remoteip, challenge, response )
#   check the user's answer
#     remoteip	- the user's IP address
#     challenge	- the solvemedia puzzle challenge id
#     response	- the user's answer


class SolveMedia:
    def __init__( me, ckey, vkey, hkey ):
        me.ckey = ckey
        me.vkey = vkey
        me.hkey = hkey

    def get_html( me, errorp = False, usessl = False ):

        if usessl :
            server = ADCOPY_API_HTTPS
        else:
            server = ADCOPY_API_HTTP

        if errorp:
            param = ";error=1"
        else:
            param = ""

        html = """
<!-- start solvemedia puzzle widget -->
  <script type="text/javascript"
     src="%(baseurl)s/papi/challenge.script?k=%(ckey)s%(param)s">
  </script>

  <noscript>
     <iframe id="capif" src="%(baseurl)s/papi/challenge.noscript?k=%(ckey)s%(param)s"
         height="150" width="350" frameborder="0"></iframe><br>
     <textarea name="adcopy_challenge" rows="3" cols="40">
     </textarea>
     <input type="hidden" name="adcopy_response"
         value="manual_challenge">
  </noscript>
<!-- end solvemedia puzzle widget -->
""" % {
        'ckey'		: me.ckey,
        'baseurl'	: server,
        'param'		: param,
    }

        return html



    def check_answer( me, remoteip, challenge, response,callback=None ):
        req = urllib2.Request( ADCOPY_VERIFY_HTTP,
                           urllib.urlencode( {
                		'privatekey'	: me.vkey,
                		'remoteip'	: remoteip,
                		'challenge'	: challenge,
                		'response'	: response,
                           } ), {
            			'User-Agent'	: 'solvemedia-python-client',
                           } )

        try:
            resp = urllib2.urlopen(req)
        except:
            if callback != None:
              return callback({ 'is_valid': False, 'error' : 'server error' })
            return { 'is_valid': False, 'error' : 'server error' }

        line = resp.read().splitlines()

        # validate message authenticator
        if me.hkey:
            # hash = hashlib.sha1( line[0] + challenge + me.hkey ).hexdigest()
            hash = sha.new( line[0] + challenge + me.hkey ).hexdigest()
            if hash != line[2]:
                if callback != None:
                  return callback({ 'is_valid' : False, 'error' : 'hash-fail' })
                return { 'is_valid' : False, 'error' : 'hash-fail' }

        if line[0] == 'true':
            if callback != None:
              return callback({ 'is_valid' : True })
            return { 'is_valid' : True }
        else:
            if callback != None:
              return callback({ 'is_valid' : False, 'error' : line[1] })
            return { 'is_valid' : False, 'error' : line[1] }



