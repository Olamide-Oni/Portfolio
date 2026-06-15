(function () {
  const CDN_PSL_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/psl/dist/psl.min.js";
  // TODO: Change this to the production URL
 // const API_BASE_URL = "https://www.referly.so";
   const API_BASE_URL = "http://localhost:3000";

  
  // Only these URL params are supported for affiliate tracking
  const AFFILIATE_PARAMS = [
    "ref", "via", "partner", "aff", "id", "r", "invite", "plgid", "a", "stream",
    "mhk", "bt", "coupon", "promo", "with", "envoy", "plref", "refcode", "share",
    "s", "go", "partener", "virtual", "now", "vca", "offer", "am_id", "vap",
    "ooo", "freshbook", "img", "join", "referral_code", "fpr", "inv", "cpn",
    "trovabando", "fp_ref"
  ];
  
  // Default cookie duration in days (used when we can't fetch program data)
  const DEFAULT_COOKIE_DURATION = 60;


  // =============================================
    // DEBUG LOGGER
  // =============================================

    let DEBUG_LOGGING_ENABLED = true;

    function log(...args) {
      if (DEBUG_LOGGING_ENABLED && typeof console !== "undefined") {
          console.log("[Push Lap Growth]", ...args);
      }
    }

  // =============================================
  // STORAGE ABSTRACTION (Cookie + localStorage fallback)
  // =============================================

  function loadPslScript(callback) {
    const script = document.createElement("script");
    script.src = CDN_PSL_SCRIPT_URL;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function removeSubdomain(hostname) {
    if (hostname === "localhost") return hostname;
    if (typeof psl === "undefined") return hostname;
    const parsed = psl.parse(hostname);
    return parsed.domain;
  }

  // Check if cookies are available
  function areCookiesEnabled() {
    try {
      document.cookie = "plg_test=1; SameSite=Lax";
      const cookiesEnabled = document.cookie.indexOf("plg_test=") !== -1;
      document.cookie =
        "plg_test=1; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      return cookiesEnabled;
    } catch (e) {
      return false;
    }
  }

  // Check if localStorage is available
  function isLocalStorageAvailable() {
    try {
      const testKey = "plg_ls_test";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  const useLocalStorage = !areCookiesEnabled() && isLocalStorageAvailable();

  
  
  log("Push Lap Growth: Using " +
      (useLocalStorage ? "localStorage" : "cookies") +
      " for storage"
    );

  // Cross-domain tracking approved domains (populated after API fetch)
  let crossTrackingDomains = [];

  // Cross-domain handoff parameter names (used to pass affiliate data between domains)
  const CROSS_DOMAIN_REF_PARAM = "_plg_ref";
  const CROSS_DOMAIN_CID_PARAM = "_plg_cid";

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const domain = removeSubdomain(window.location.hostname);
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; expires=${expires}; path=/; domain=.${domain}; samesite=none; secure`;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2)
      return decodeURIComponent(parts.pop().split(";").shift());
  }

  function deleteCookie(name) {
    const domain = removeSubdomain(window.location.hostname);
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}; samesite=none; secure`;
  }

  // Unified storage functions with fallback
  function setStorage(name, value, days) {
    if (useLocalStorage) {
      try {
        const data = {
          value: value,
          expires: Date.now() + days * 864e5,
        };
        localStorage.setItem(name, JSON.stringify(data));
      } catch (e) {
        log("Push Lap Growth: localStorage setItem failed", e);
      }
    } else {
      setCookie(name, value, days);
    }
  }

  function getStorage(name) {
    if (useLocalStorage) {
      try {
        const item = localStorage.getItem(name);
        if (!item) return null;
        const data = JSON.parse(item);
        if (data.expires && Date.now() > data.expires) {
          localStorage.removeItem(name);
          return null;
        }
        return data.value;
      } catch (e) {
        return null;
      }
    } else {
      return getCookie(name);
    }
  }

  function deleteStorage(name) {
    if (useLocalStorage) {
      try {
        localStorage.removeItem(name);
      } catch (e) {
        log("Push Lap Growth: localStorage removeItem failed", e);
      }
    } else {
      deleteCookie(name);
    }
  }

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  function getQueryParam(param) {
    const scripts = document.getElementsByTagName("script");
    const currentScript = Array.from(scripts).find(
      (script) =>
        script.src &&
        (
          script.src.startsWith(`${API_BASE_URL}/affiliate-tracker.js`) || script.src.startsWith(`https://referly.so/affiliate-tracker.js`) ||
          script.src.startsWith("https://pushlapgrowth.com/affiliate-tracker.js") || script.src.startsWith("https://cdn.jsdelivr.net/npm/affiliate-tracker/dist/affiliate-tracker.js")
        )
    );
    if (!currentScript?.src) return null;
    const scriptUrl = new URL(currentScript.src);
    return scriptUrl.searchParams.get(param);
  }

  function setPickaxe(affiliateId) {
    window.PickaxeStudioConfig = {
      ...window.PickaxeStudioConfig,
      affiliateId: affiliateId,
    };
  }

  // =============================================
  // BROWSER DATA COLLECTION
  // =============================================

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || null,
      utmMedium: params.get("utm_medium") || null,
      utmCampaign: params.get("utm_campaign") || null,
      utmTerm: params.get("utm_term") || null,
      utmContent: params.get("utm_content") || null,
      gclid: params.get("gclid") || null,
      gbraid: params.get("gbraid") || null,
      wbraid: params.get("wbraid") || null,
      fbclid: params.get("fbclid") || null,
      msclkid: params.get("msclkid") || null,
      ttclid: params.get("ttclid") || null,
      twclid: params.get("twclid") || null,
      liFatId: params.get("li_fat_id") || null,
    };
  }

  function parseReferrerDomain(referrer) {
    if (!referrer) return null;
    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch (e) {
      return null;
    }
  }

  function classifyReferrerType(referrerDomain, urlParams) {
    if (!referrerDomain) return "direct";

    // Check for paid traffic via click IDs
    if (urlParams.gclid || urlParams.gbraid || urlParams.wbraid) return "paid";
    if (urlParams.fbclid) return "paid";
    if (urlParams.msclkid) return "paid";
    if (urlParams.ttclid) return "paid";
    if (urlParams.twclid) return "paid";
    if (urlParams.liFatId) return "paid";

    const domain = referrerDomain.toLowerCase();

    // Search engines
    const searchEngines = [
      "google",
      "bing",
      "yahoo",
      "duckduckgo",
      "baidu",
      "yandex",
      "ecosia",
      "ask",
      "aol",
      "startpage",
      "qwant",
      "brave",
    ];
    if (searchEngines.some((se) => domain.includes(se))) return "search";

    // Social media platforms
    const socialPlatforms = [
      "facebook",
      "fb.com",
      "instagram",
      "twitter",
      "x.com",
      "linkedin",
      "pinterest",
      "tiktok",
      "reddit",
      "youtube",
      "snapchat",
      "whatsapp",
      "telegram",
      "discord",
      "tumblr",
      "threads.net",
      "mastodon",
    ];
    if (socialPlatforms.some((sp) => domain.includes(sp))) return "social";

    // Email providers (common ones)
    const emailProviders = [
      "mail",
      "outlook",
      "yahoo",
      "gmail",
      "protonmail",
      "zoho",
      "mailchimp",
      "sendgrid",
      "constantcontact",
      "hubspot",
      "klaviyo",
      "convertkit",
      "drip",
    ];
    if (emailProviders.some((ep) => domain.includes(ep))) return "email";

    return "unknown";
  }

  function parseBrowserInfo(userAgent) {
    if (!userAgent) return { browserName: null, browserVersion: null };

    let browserName = null;
    let browserVersion = null;

    // Order matters - check more specific patterns first
    if (userAgent.includes("Edg/")) {
      browserName = "Edge";
      browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("OPR/") || userAgent.includes("Opera")) {
      browserName = "Opera";
      browserVersion = userAgent.match(/(?:OPR|Opera)\/([0-9.]+)/)?.[1] || null;
    } else if (
      userAgent.includes("Chrome/") &&
      !userAgent.includes("Chromium")
    ) {
      browserName = "Chrome";
      browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
      browserName = "Safari";
      browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("Firefox/")) {
      browserName = "Firefox";
      browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
      browserName = "Internet Explorer";
      browserVersion = userAgent.match(/(?:MSIE |rv:)([0-9.]+)/)?.[1] || null;
    }

    return { browserName, browserVersion };
  }

  function parseOsInfo(userAgent) {
    if (!userAgent) return { osName: null, osVersion: null };

    let osName = null;
    let osVersion = null;

    if (userAgent.includes("Windows")) {
      osName = "Windows";
      if (userAgent.includes("Windows NT 10.0")) osVersion = "10";
      else if (userAgent.includes("Windows NT 6.3")) osVersion = "8.1";
      else if (userAgent.includes("Windows NT 6.2")) osVersion = "8";
      else if (userAgent.includes("Windows NT 6.1")) osVersion = "7";
    } else if (userAgent.includes("Mac OS X")) {
      osName = "macOS";
      const match = userAgent.match(/Mac OS X ([0-9_]+)/);
      if (match) osVersion = match[1].replace(/_/g, ".");
    } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
      osName = "iOS";
      const match = userAgent.match(/OS ([0-9_]+)/);
      if (match) osVersion = match[1].replace(/_/g, ".");
    } else if (userAgent.includes("Android")) {
      osName = "Android";
      const match = userAgent.match(/Android ([0-9.]+)/);
      if (match) osVersion = match[1];
    } else if (userAgent.includes("Linux")) {
      osName = "Linux";
    } else if (userAgent.includes("CrOS")) {
      osName = "Chrome OS";
    }

    return { osName, osVersion };
  }

  function detectDeviceType(userAgent) {
    if (!userAgent) return "desktop";
    const ua = userAgent.toLowerCase();

    // Check for tablets first
    if (
      ua.includes("ipad") ||
      (ua.includes("android") && !ua.includes("mobile")) ||
      ua.includes("tablet")
    ) {
      return "tablet";
    }

    // Check for mobile devices
    if (
      ua.includes("mobile") ||
      ua.includes("iphone") ||
      ua.includes("ipod") ||
      ua.includes("android") ||
      ua.includes("blackberry") ||
      ua.includes("windows phone")
    ) {
      return "mobile";
    }

    return "desktop";
  }

  function collectBrowserData() {
    const userAgent = navigator.userAgent || null;
    const urlParams = getUrlParams();
    const referrerDomain = parseReferrerDomain(document.referrer);
    const { browserName, browserVersion } = parseBrowserInfo(userAgent);
    const { osName, osVersion } = parseOsInfo(userAgent);
    const deviceType = detectDeviceType(userAgent);

    return {
      // URL and Landing Page Data
      fullLandingUrl: window.location.href,
      pathname: window.location.pathname,
      queryString: window.location.search || null,

      // UTM Parameters
      ...urlParams,

      // Referrer Data
      documentReferrer: document.referrer || null,
      referrerDomain: referrerDomain,
      referrerType: classifyReferrerType(referrerDomain, urlParams),

      // User Agent and Device Info
      userAgent: userAgent,
      browserName: browserName,
      browserVersion: browserVersion,
      osName: osName,
      osVersion: osVersion,
      deviceType: deviceType,

      // Screen and Viewport Data
      screenWidth: window.screen?.width || null,
      screenHeight: window.screen?.height || null,
      colorDepth: window.screen?.colorDepth || null,
      pixelRatio: window.devicePixelRatio || null,
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,

      // Language Settings
      language: navigator.language || null,
      languages: navigator.languages
        ? JSON.stringify(navigator.languages)
        : null,
    };
  }

  // =============================================
  // SHOPIFY CART ATTRIBUTE SYNC
  // =============================================

  function isShopifyStore() {
    return typeof window.Shopify !== "undefined" || document.querySelector('script[src*="cdn.shopify.com"]') !== null;
  }

  function updateShopifyCartAttributes(clickId) {
    if (!isShopifyStore()) return;
    try {
      fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: { pushlap_affiliate_id: clickId },
        }),
      })
        .then(function () {
          log("Shopify cart updated with affiliate clickId:", clickId);
        })
        .catch(function (err) {
          log("Error updating Shopify cart attributes:", err);
        });
    } catch (e) {
      log("Error updating Shopify cart attributes:", e);
    }
  }

  // =============================================
  // CROSS-DOMAIN TRACKING: Link Decoration
  // =============================================

  // Check if a hostname matches any approved cross-tracking domain (including subdomains)
  function isApprovedCrossDomain(hostname) {
    if (!crossTrackingDomains || crossTrackingDomains.length === 0) return false;
    var targetDomain = hostname.toLowerCase();
    for (var i = 0; i < crossTrackingDomains.length; i++) {
      var approved = crossTrackingDomains[i].toLowerCase();
      // Exact match or subdomain match (e.g. shop.example.com matches example.com)
      if (targetDomain === approved || targetDomain.endsWith("." + approved)) {
        return true;
      }
    }
    return false;
  }

  // Check if a link points to a DIFFERENT approved cross-tracking domain
  function isCrossDomainLink(anchorElement) {
    try {
      var linkHostname = anchorElement.hostname;
      if (!linkHostname) return false;
      // Must point to an approved domain
      if (!isApprovedCrossDomain(linkHostname)) return false;
      // Must be a different domain than the current page
      var currentRoot = removeSubdomain(window.location.hostname);
      var linkRoot = removeSubdomain(linkHostname);
      return currentRoot !== linkRoot;
    } catch (e) {
      return false;
    }
  }

  // Decorate a URL with affiliate cross-domain tracking params
  function decorateUrl(url, ref, clickId) {
    try {
      var urlObj = new URL(url);
      urlObj.searchParams.set(CROSS_DOMAIN_REF_PARAM, ref);
      if (clickId) {
        urlObj.searchParams.set(CROSS_DOMAIN_CID_PARAM, clickId);
      }
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  // Set up link decoration on all outbound links to approved cross-tracking domains
  function setupCrossDomainLinkDecoration() {
    if (!crossTrackingDomains || crossTrackingDomains.length === 0) return;
    if (!window.affiliateRef) return;

    log("Setting up cross-domain link decoration for", crossTrackingDomains.length, "domains");

    // Use event delegation on document to catch all link clicks (including dynamically added links)
    document.addEventListener("click", function (e) {
      // Don't decorate if no affiliate data
      if (!window.affiliateRef) return;

      // Walk up the DOM to find the closest <a> tag
      var target = e.target;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }
      if (!target || !target.href) return;

      // Check if this link points to a different approved cross-domain
      if (isCrossDomainLink(target)) {
        var decorated = decorateUrl(target.href, window.affiliateRef, window.affiliateId);
        log("Decorating cross-domain link:", target.href, "->", decorated);
        target.href = decorated;
      }
    }, true); // Use capture phase to run before other click handlers

    // Also handle form submissions that go to cross-domains
    document.addEventListener("submit", function (e) {
      if (!window.affiliateRef) return;
      var form = e.target;
      if (!form || !form.action) return;

      try {
        var actionUrl = new URL(form.action);
        if (isApprovedCrossDomain(actionUrl.hostname)) {
          var currentRoot = removeSubdomain(window.location.hostname);
          var formRoot = removeSubdomain(actionUrl.hostname);
          if (currentRoot !== formRoot) {
            actionUrl.searchParams.set(CROSS_DOMAIN_REF_PARAM, window.affiliateRef);
            if (window.affiliateId) {
              actionUrl.searchParams.set(CROSS_DOMAIN_CID_PARAM, window.affiliateId);
            }
            form.action = actionUrl.toString();
            log("Decorating cross-domain form action:", form.action);
          }
        }
      } catch (e) {
        // Ignore invalid action URLs
      }
    }, true);
  }

  // Check for cross-domain handoff parameters in the URL and restore affiliate data
  // Returns { ref, clickId } if found, null otherwise
  function checkCrossDomainHandoff() {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get(CROSS_DOMAIN_REF_PARAM);
    var clickId = params.get(CROSS_DOMAIN_CID_PARAM);

    if (ref) {
      log("Cross-domain handoff detected: ref=" + ref + ", clickId=" + clickId);

      // Clean the cross-domain params from the URL without reloading
      params.delete(CROSS_DOMAIN_REF_PARAM);
      params.delete(CROSS_DOMAIN_CID_PARAM);
      var cleanSearch = params.toString();
      var cleanUrl = window.location.pathname + (cleanSearch ? "?" + cleanSearch : "") + window.location.hash;
      try {
        window.history.replaceState(window.history.state, "", cleanUrl);
      } catch (e) {
        // Ignore if replaceState fails (e.g. cross-origin iframe)
      }

      return { ref: ref, clickId: clickId };
    }
    return null;
  }

  // =============================================
  // MAIN TRACKING LOGIC
  // =============================================

  loadPslScript(async function () {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for cross-domain handoff params BEFORE any other processing
    const crossDomainHandoff = checkCrossDomainHandoff();

    const affiliateProgramId =
      document
        .querySelector("script[data-affiliate]")
        ?.getAttribute("data-program-id") ?? getQueryParam("programId");
    log("Affiliate Program ID: ", affiliateProgramId);

    if (!affiliateProgramId) return;

    // Initialize window variables early
    window.affiliateRef = null;
    window.affiliateId = null;

    const refCookieName = `${affiliateProgramId}_affiliate_ref`;
    const clickIdCookieName = `${affiliateProgramId}_affiliate_referral`;

    let existingRef = getStorage(refCookieName) || null;
    let existingClickId = getStorage(clickIdCookieName) || null;

    // If we received a cross-domain handoff, use that data to populate local storage
    if (crossDomainHandoff) {
      existingRef = crossDomainHandoff.ref;
      existingClickId = crossDomainHandoff.clickId || null;
      log("Restoring affiliate data from cross-domain handoff");
    }

    log("Existing Affiliate Ref:", existingRef);
    log("Existing Click ID:", existingClickId);

    // =============================================
    // OPTIMIZATION: Quick check if ANY potential affiliate param exists in URL
    // This avoids API calls for visitors with no affiliate params at all
    // =============================================
    
    let hasPotentialAffiliateParam = false;
    log("Checking for potential affiliate params:", AFFILIATE_PARAMS);
    for (const param of AFFILIATE_PARAMS) {
      log("Checking for potential affiliate param:", param);
      log("URL params:", urlParams);
      if (urlParams.has(param)) {
        hasPotentialAffiliateParam = true;
        log(`Found potential affiliate param in URL: ${param}`);
        break;
      }
    }

    // Case 1: No potential affiliate param in URL AND no existing cookie AND no cross-domain handoff - return early
    if (!hasPotentialAffiliateParam && !existingRef) {
      log("No affiliate tracking active - no API calls needed");
      setTimeout(() => dispatchEvent(new Event("affiliate_referral_ready")), 100);
      return;
    }

    // Case 2: Existing cookies (or cross-domain handoff) with valid data AND no potential new param
    if (existingRef && existingClickId && !hasPotentialAffiliateParam) {
      log("Using existing affiliate data from storage - no API calls needed");

      // Persist to this domain's storage (important for cross-domain handoff)
      setStorage(refCookieName, existingRef, DEFAULT_COOKIE_DURATION);
      setStorage(clickIdCookieName, existingClickId, DEFAULT_COOKIE_DURATION);

      window.affiliateRef = existingRef;
      window.affiliateId = existingClickId;
      setPickaxe(existingClickId);
      updateShopifyCartAttributes(existingClickId);
      
      dispatchEvent(
        new CustomEvent("affiliate_id_ready", {
          detail: { ref: existingRef, clickId: existingClickId },
        })
      );
      setTimeout(() => dispatchEvent(new Event("affiliate_referral_ready")), 100);

      // Still need to fetch program data for cross-domain link decoration
      try {
        log("Fetching program data for link decoration:", `${API_BASE_URL}/api/affiliates/affiliate-program-v2?programId=${affiliateProgramId}`);
        const programResponse = await fetch(
          `${API_BASE_URL}/api/affiliates/affiliate-program-v2?programId=${affiliateProgramId}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        const programData = await programResponse.json();
        if (programData && programData.program) {
          if (programData.program.crossTrackingDomains && 
              Array.isArray(programData.program.crossTrackingDomains)) {
            crossTrackingDomains = programData.program.crossTrackingDomains;
            log("Cross-tracking domains:", crossTrackingDomains);
            setupCrossDomainLinkDecoration();
          }
        }
      } catch (e) {
        log("Could not fetch program data for link decoration:", e);
      }
      return;
    }

    // =============================================
    // At this point, we need to fetch program data to:
    // 1. Get the actual urlModifier to verify the URL param
    // 2. Get cookie duration for new clicks
    // =============================================

    try {
      // Fetch program data to get urlModifier and cookie duration
      let cookieDuration = DEFAULT_COOKIE_DURATION;
      let urlModifier = "ref"; // Default fallback

      log("Fetching program data for link decoration:", `${API_BASE_URL}/api/affiliates/affiliate-program-v2?programId=${affiliateProgramId}`);
      try {
        const affiliateProgramResponse = await fetch(
          `${API_BASE_URL}/api/affiliates/affiliate-program-v2?programId=${affiliateProgramId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const affiliateProgramData = await affiliateProgramResponse.json();
        log("Affiliate Program Data:", affiliateProgramData);

        if (affiliateProgramData && affiliateProgramData.program) {
         // DEBUG_LOGGING_ENABLED = Boolean(affiliateProgramData.program.enableDebugLogs);
          cookieDuration = affiliateProgramData.program.cookieDuration ?? DEFAULT_COOKIE_DURATION;
          urlModifier = affiliateProgramData.program.urlModifier || "ref";
          
          // Set cross-domain tracking domains
          if (affiliateProgramData.program.crossTrackingDomains && 
              Array.isArray(affiliateProgramData.program.crossTrackingDomains)) {
            crossTrackingDomains = affiliateProgramData.program.crossTrackingDomains;
            log("Cross-tracking domains:", crossTrackingDomains);
          }
        }
      } catch (fetchError) {
        log("Could not fetch program data, using defaults:", fetchError);
      }

      log("Program urlModifier:", urlModifier);

      // Now get the ACTUAL affiliate param using the program's specific urlModifier
      const affiliateParam = urlParams.get(urlModifier);
      log(`Affiliate param from URL (${urlModifier}=):`, affiliateParam);

      // Case 3: Existing cookies with valid data AND (no matching param OR same param) - use stored values
      if (existingRef && existingClickId && !affiliateParam) {
        log("Using existing affiliate data from storage");
        window.affiliateRef = existingRef;
        window.affiliateId = existingClickId;
        setPickaxe(existingClickId);
        updateShopifyCartAttributes(existingClickId);
        
        // Persist to this domain's storage (important for cross-domain handoff)
        setStorage(refCookieName, existingRef, cookieDuration);
        setStorage(clickIdCookieName, existingClickId, cookieDuration);

        dispatchEvent(
          new CustomEvent("affiliate_id_ready", {
            detail: { ref: existingRef, clickId: existingClickId },
          })
        );
        setTimeout(() => dispatchEvent(new Event("affiliate_referral_ready")), 100);
        setupCrossDomainLinkDecoration();
        return;
      }

      // Case 3b: Existing cookies with valid data AND same param - use stored values
      // This case is used to track multiple clicks

      if (existingRef && existingClickId && (affiliateParam === existingRef)) {
        log("Using existing affiliate data from storage for multiple clicks support");
        window.affiliateRef = existingRef;
        window.affiliateId = existingClickId;
        const previousId = existingClickId;

        //===============================
        // NEW LINE FOR MULTIPLE CLICKS

        // Create the new multiple click for the affiliate
        log("Creating new click for affiliate:", existingRef);

        const browserData = collectBrowserData();
        log("[PUSHLAP GROWTH]: Creating Multiple clicks for affiliate:", existingRef);
        const response = await fetch(
          `${API_BASE_URL}/api/affiliates/add-click`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              programId: affiliateProgramId,
              referralCode: existingRef,
              uniqueClick: false,
              ...browserData,
            }),
          }
        );

        const data = await response.json();

        if (data.click) {
          // Update window.affiliateId from ref to the actual click ID
          const clickId = String(data.click.id);
          window.affiliateId = clickId;
          const previousId = existingClickId;

          // Save both ref and click ID to storage
          setStorage(refCookieName, existingRef, cookieDuration);
          setStorage(clickIdCookieName, clickId, cookieDuration);

          // Set Pickaxe with the clickId (affiliateId)
          setPickaxe(clickId);
          updateShopifyCartAttributes(clickId);

          log("Click created with ID:", clickId);
          log("Updated window.affiliateId from ref to click ID:", {
            previous: previousId,
            current: clickId,
          });

          dispatchEvent(
            new CustomEvent("affiliate_id_ready", {
              detail: { ref: existingRef, clickId: clickId },
            })
          );

          // Set up cross-domain link decoration after tracking is resolved
          setupCrossDomainLinkDecoration();
        }
        return;
      }
      //==============================
      // END OF MULTIPLE CLICKS
      // ===========================

      // Case 4: No valid affiliate param (URL param doesn't match urlModifier) AND no existing ref
      if (!affiliateParam && !existingRef) {
        log("No matching affiliate param for this program's urlModifier - no tracking needed");
        setTimeout(() => dispatchEvent(new Event("affiliate_referral_ready")), 100);
        return;
      }

      // =============================================
      // At this point, we have a new affiliate param that needs to be processed
      // OR we have an existing ref but no click ID (incomplete state)
      // =============================================

      // Set the affiliate ref for the new affiliate
      const currentAffiliateParam = affiliateParam || existingRef;
      window.affiliateRef = currentAffiliateParam;
      window.affiliateId = currentAffiliateParam; // Temporarily set to ref, will be updated with click ID

      // Create the click
      log("Creating new click for affiliate:", currentAffiliateParam);

      const browserData = collectBrowserData();

      const response = await fetch(
        `${API_BASE_URL}/api/affiliates/add-click`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            programId: affiliateProgramId,
            referralCode: currentAffiliateParam,
            ...browserData,
          }),
        }
      );
      const data = await response.json();

      if (data.click) {
        // Update window.affiliateId from ref to the actual click ID
        const clickId = String(data.click.id);
        const previousId = window.affiliateId;
        window.affiliateId = clickId;

        // Save both ref and click ID to storage
        setStorage(refCookieName, currentAffiliateParam, cookieDuration);
        setStorage(clickIdCookieName, clickId, cookieDuration);

        // Set Pickaxe with the clickId (affiliateId)
        setPickaxe(clickId);
        updateShopifyCartAttributes(clickId);

        log("Click created with ID:", clickId);
        log("Updated window.affiliateId from ref to click ID:", {
          previous: previousId,
          current: clickId,
        });

        dispatchEvent(
          new CustomEvent("affiliate_id_ready", {
            detail: { ref: currentAffiliateParam, clickId: clickId },
          })
        );
      }

      dispatchEvent(new Event("affiliate_referral_ready"));

      // Set up cross-domain link decoration after tracking is resolved
      setupCrossDomainLinkDecoration();
    } catch (error) {
      deleteStorage(refCookieName);
      deleteStorage(clickIdCookieName);
      window.affiliateRef = null;
      window.affiliateId = null;
      log("Error handling click:", error);
      // Still dispatch the event so integrations know tracking is complete (even if failed)
      dispatchEvent(new Event("affiliate_referral_ready"));
    }
  });

  // =============================================
  // PUBLIC API FUNCTIONS
  // =============================================

  async function createPushLapEmail(email, name = "") {
    if (!email) {
      throw new Error("Email is required");
    }

    if (!window.affiliateRef) {
      return null;
    }

    try {
      const programIdElement = document.querySelector("script[data-affiliate]");
      const programId = programIdElement
        ? programIdElement.getAttribute("data-program-id")
        : getQueryParam("programId");

      log("Program ID for email capture:", programId);

      const response = await fetch(
        `${API_BASE_URL}/api/affiliates/capture-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            name: name == "" ? email : name,
            affiliateId: window.affiliateRef,
            clickId: window.affiliateId,
            programId: programId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create email capture");
      }

      return await response.json();
    } catch (error) {
      log("Error creating Push Lap email:", error);
      return null;
    }
  }

  // Make function available globally
  window.createPushLapEmail = createPushLapEmail;

  function createPushLapSale({ userId = "", amount, name = "", email }) {
    // Return early if no affiliate ref
    if (!window.affiliateRef) {
      return null;
    }

    // Validate required parameters
    if (!email || amount === undefined || amount === null) {
      log("email and amount are required parameters");
      return null;
    }

    const programIdElement = document.querySelector("script[data-affiliate]");
    const programId = programIdElement
      ? programIdElement.getAttribute("data-program-id")
      : getQueryParam("programId");

    log("Program ID for sale:", programId);

    // Make API call to record sale
    return fetch(`${API_BASE_URL}/api/affiliates/capture-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        amount,
        name,
        email,
        affiliateId: window.affiliateRef,
        clickId: window.affiliateId,
        programId: programId,
        url: window.location.href,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to record sale");
        }
        return response.json();
      })
      .catch((error) => {
        log("Error recording sale:", error);
        return null;
      });
  }

  // Make function available globally
  window.createPushLapSale = createPushLapSale;

  // =============================================
  // ADD TO CART TRACKING
  // =============================================

  function pushLapTrackAddToCart(options) {
    options = options || {};

    if (!window.affiliateId) {
      log("Skipping add-to-cart: no clickId in storage");
      return null;
    }

    const programIdElement = document.querySelector("script[data-affiliate]");
    const programId = programIdElement
      ? programIdElement.getAttribute("data-program-id")
      : getQueryParam("programId");

    if (!programId) {
      log("Skipping add-to-cart: no programId");
      return null;
    }

    return fetch(`${API_BASE_URL}/api/affiliates/add-to-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        programId: programId,
        clickId: window.affiliateId,
        source: options.source || "GENERIC",
        sessionId: options.sessionId || null,
        externalEventId: options.externalEventId || null,
        productId: options.productId || null,
        variantId: options.variantId || null,
        productTitle: options.productTitle || null,
        quantity:
          typeof options.quantity === "number" ? options.quantity : 1,
        unitPrice:
          typeof options.unitPrice === "number" ? options.unitPrice : null,
        currency: options.currency || null,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to record add-to-cart");
        }
        return response.json();
      })
      .catch((error) => {
        log("Error recording add-to-cart:", error);
        return null;
      });
  }

  window.pushLapTrackAddToCart = pushLapTrackAddToCart;

  // =============================================
  // HELPER TO GET AFFILIATE INFO
  // =============================================

  function getPushLapAffiliateInfo() {
    return {
      ref: window.affiliateRef || null,
      clickId: window.affiliateId || null,
      storageType: useLocalStorage ? "localStorage" : "cookies",
    };
  }

  // Make function available globally
  window.getPushLapAffiliateInfo = getPushLapAffiliateInfo;

  // =============================================
  // LOAD POPUP/BANNER SCRIPT
  // =============================================

  function loadPopupBannerScript() {
    if (document.getElementById("plg-popup-banner-script")) return;
    var programIdEl = document.querySelector("script[data-affiliate]");
    var programId = programIdEl
      ? programIdEl.getAttribute("data-program-id")
      : getQueryParam("programId");
    if (!programId) return;

    var script = document.createElement("script");
    script.id = "plg-popup-banner-script";
    script.src = API_BASE_URL + "/popup-banner.js";
    script.setAttribute("data-popup-banner-program", programId);
    script.async = true;
    document.head.appendChild(script);
  }

  window.addEventListener("affiliate_referral_ready", function () {
    log("Affiliate referral ready event received");
    if (window.affiliateRef || window.affiliateId) {
      log("Loading Popup Banner Script");
      loadPopupBannerScript();
    }
  });
})();
