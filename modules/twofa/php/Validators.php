<?php

namespace io\privfs\plugin\twofa;

use io\privfs\core\Validator;

class Validators {
    
    public function __construct($that) {
        
        $this->getData = $that->createObject(array(
        ));
        
        $this->disable = $that->createObject(array(
        ));
        
        $this->enable = $that->createObject(array(
            "data" => $that->createObject(array(
                "type" => $that->createEnum(array("googleAuthenticator", "email", "sms")),
                "email" => $that->maybeEmptyString($that->email),
                "mobile" => $that->maybeEmptyString($that->extend($that->string, array("regex" => '/^[0-9\+ ]{3,18}$/'))),
                "googleAuthenticatorKey" => $that->maybeEmpty($that->extend($that->string, array("regex" => '/^[234567a-z ]{32,39}$/')))
            ))
        ));
        
        $this->challenge = $that->createObject(array(
            "code" => $that->maxLength($that->string, 20),
            "rememberDeviceId" => $that->optional($that->bool)
        ));
        
        $this->resendCode = $that->createObject(array(
        ));
    }
    
    public function get($name) {
        return new Validator($this->{$name});
    }
}
