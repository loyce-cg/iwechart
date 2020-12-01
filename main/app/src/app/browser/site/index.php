<?php

$BASE_DIR = dirname(dirname($_SERVER["SCRIPT_FILENAME"]));
require_once($BASE_DIR."/server/vendor/autoload.php");

use \io\privfs\core\Utils;
use \io\privfs\data\IOC;

class App {
    
    public $appDir;
    public $baseDir;
    public $ioc;
    public $config;
    public $html;
    
    public function __construct($baseDir) {
        $this->baseDir = $baseDir;
        $this->ioc = new IOC();
        $this->config = $this->ioc->getConfig();
        $this->html = file_get_contents(Utils::joinPaths($this->baseDir, "app/app.html"));
    }
    
    public function regexReplace($regex, $to) {
        $this->html = preg_replace($regex, $to, $this->html);
    }
    
    public function setVar($name, $value) {
        $this->regexReplace("/" . $name . " =(.*);/", $name . " = \"" . $value . "\";");
    }
    
    public function setVarWithCheck($name, $value) {
        if ($value) {
            $this->setVar($name, $value);
        }
    }
    
    public function getVersion() {
        $packPath = Utils::joinPaths($this->baseDir, "pack.json");
        if (!file_exists($packPath)) {
            return "";
        }
        $pack = json_decode(file_get_contents($packPath), true);
        if (!$pack || !is_array($pack) || (!isset($pack["displayVersion"]) && !isset($pack["version"]))) {
            return "";
        }
        if (isset($pack["displayVersion"]) && is_string($pack["displayVersion"])) {
            return $pack["displayVersion"];
        }
        if (!is_string($pack["version"])) {
            return "";
        }
        $v = explode(".", $pack["version"]);
        return count($v) >= 3 ? implode(".", array_slice($v, 0, 3)) : "";
    }
    

    public function getPluginBuildId($path) {
        $buildIds = scandir($path);
        $newestBuildIdx = 0;
        $newestBuildTimestamp = 0;
        
        for($i=0;$i<count($buildIds); $i++) {
            $dateString = $buildIds[$i];
            if (strlen($dateString) >= 14) {
                $mTime = new DateTime();
                $mTime->setDate(substr($dateString,0,4), substr($dateString,4,2), substr($dateString,6,2));
                $mTime->setTime(substr($dateString,8,2), substr($dateString,10,2), substr($dateString,12,2));
                
                if ($mTime->getTimestamp() !== null && $mTime->getTimestamp() > $newestBuildTimestamp) {
                    $newestBuildTimestamp = $mTime->getTimestamp();
                    $newestBuildIdx = $i;
                }
            }
        }
        return $buildIds[$newestBuildIdx];
    }
    
    public function getPlugins() {
        $pluginsDir = Utils::joinPaths($this->baseDir, "plugins");
        $pluginsConfig = $this->config->getPlugins();
        $plugins = array();
        foreach (scandir($pluginsDir) as $file) {
            if ($file == "." || $file == "..") {
                continue;
            }
            $pluginDir = Utils::joinPaths($pluginsDir, $file . "/client");
            if (!is_dir($pluginDir) || (isset($pluginsConfig[$file]["enabled"]) && $pluginsConfig[$file]["enabled"] === false)) {
                continue;
            }
            array_push($plugins, array(
                "name" => $file,
                "buildId" => $this->getPluginBuildId($pluginDir)
            ));
        }
        return $plugins;
    }
    
    public function render() {
        $this->setVarWithCheck("PRIVFS_VERSION", $this->getVersion());
        $customized = $this->ioc->getCustomization()->getSettings();
        $options = array(
            "assets" => array(
                "CUSTOM_LOGO_127X112" => $customized["logoLoginScreen"] ? $customized["logoLoginScreen"] : $this->config->getCustomLogo127x112(),
                "CUSTOM_LOGO_87X22" => $customized["logoHeader"] ? $customized["logoHeader"] : $this->config->getCustomLogo87x22(),
                "CUSTOM_LOGO_87X22_WH" => $customized["logoHeaderWh"] ? $customized["logoHeaderWh"] : $this->config->getCustomLogo87x22wh(),
                "CUSTOM_LOGO_CUSTOM_FORM" => $this->config->getCustomLogoCustomForm()
            ),
            "customMenuItems" => $this->config->getEnableCustomMenuItems() ? $this->config->getCustomMenuItems() : array(),
            "features" => array(
                "demo" => $this->config->isDemoMode(),
                "search" => $this->config->getFeatureSearch(),
                "secureForms" => $this->config->getFeatureSecureForms(),
            ),
            "loginDomains" => array($_SERVER["HTTP_HOST"]),
            "initApp" => $this->config->getInitApp(),
            "logoApp" => $this->config->getLogoApp(),
            "apps" => $this->config->getApps(),
            "desktopDownloadUrl" => $this->config->getDesktopDownloadUrl(),
            "termsUrl" => $this->config->getTermsUrl(),
            "privacyPolicyUrl" => $this->config->getPrivacyPolicyUrl(),
            "instanceName" => $this->config->getInstanceName(),
            "plugins" => $this->getPlugins(),
            "customizedTheme" => $customized,
        );
        $this->regexReplace("/window.options =(.*);/s", "window.options = " . json_encode($options, JSON_PRETTY_PRINT) . ";");
        $this->regexReplace("/\<style type\=\"text\/css\"\>\<\/style\>/s", "<style type=\"text/css\">" . $customized["css"] . "</style>");
        $this->regexReplace("/document.title = location.hostname;/s", "document.title = " . ($customized["title"] ? ("'" . $customized["title"] . "'") : "location.hostname") . ";");
        return $this->html;
    }
    
    public static function main($baseDir) {
        IOC::checkConfigAndHttps("../");
        $app = new App($baseDir);
        echo($app->render());
    }
}

App::main($BASE_DIR);
