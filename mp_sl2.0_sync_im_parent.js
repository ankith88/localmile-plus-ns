/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Created on Thu Jul 02 2026
 * Modified on Thu Jul 02 2026
 * SuiteScript Version:  2.0
 * Description:
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
  "N/task",
  "N/email",
  "N/runtime",
  "N/search",
  "N/record",
  "N/format",
  "N/https"
], function (task, email, runtime, search, record, format, https) {
  var main_JSON = "";

  function onRequest(context) {
    if (context.request.method === "GET") {
      var todayDate = new Date();
      var yesterdayDate = new Date(todayDate);

      log.audit({
        title: "todayDate",
        details: todayDate
      });

      // dialers.forEach(function (d) { dialerCounts[d] = 0; });

      //GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
      var tokenBody =
        '{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";

      var responseAccessToken = https.request({
        method: https.Method.POST,
        url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
        headers: apiHeaders,
        body: tokenBody
      });

      log.debug({
        title: "Firebase Access Token Response",
        details: responseAccessToken.body
      });

      var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

      var idToken = responseAccessTokenObj.idToken;
      // idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
      var refreshToken = responseAccessTokenObj.refreshToken;

      log.audit({
        title: "context.request.parameters",
        details: context.request.parameters
      });

      var internalid = context.request.parameters.customerInternalId;

      //Get Contact Details
      // NetSuite Search: SALESP - Contacts
      var searched_contacts = search.load({
        id: "customsearch_salesp_contacts",
        type: "contact"
      });

      searched_contacts.filters.push(
        search.createFilter({
          name: "internalid",
          join: "CUSTOMER",
          operator: search.Operator.ANYOF,
          values: parseInt(internalid)
        })
      );
      resultSetContacts = searched_contacts.run();

      var serviceContactResult = resultSetContacts.getRange({
        start: 0,
        end: 1
      });

      var primaryContactInternalID = "";
      var imContactFName = "";
      var imContactLName = "";
      var imContactEmail = "";
      var imContactPhone = "";
      if (serviceContactResult.length == 1) {
        primaryContactInternalID = serviceContactResult[0].getValue({
          name: "internalid"
        });
        imContactFName = serviceContactResult[0].getValue({
          name: "firstname"
        });
        imContactLName = serviceContactResult[0].getValue({
          name: "lastname"
        });
        imContactEmail = serviceContactResult[0].getValue({
          name: "email"
        });
        imContactPhone = serviceContactResult[0].getValue({
          name: "phone"
        });
      }

      log.debug({
        title: "primaryContactInternalID",
        details: primaryContactInternalID
      });

      log.debug({
        title: "IM Contact Details",
        details: {
          firstName: imContactFName,
          lastName: imContactLName,
          email: imContactEmail,
          phone: imContactPhone
        }
      });

      var localmileChecIMExistsURL =
        "https://localmile-plus.web.app/api/v1/companies/" +
        internalid +
        "/exists";

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] =
        "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

      var responseChecIMExists = https.request({
        method: https.Method.GET,
        url: localmileChecIMExistsURL,
        headers: apiHeaders
      });

      log.debug({
        title: "responseChecIMExists",
        details: responseChecIMExists
      });

      var myresponseChecIMExists_body = responseChecIMExists.body;
      var myresponseChecIMExists_code = responseChecIMExists.code;

      log.debug({
        title: "myresponseChecIMExists_body",
        details: myresponseChecIMExists_body
      });

      log.debug({
        title: "myresponseChecIMExists_code",
        details: myresponseChecIMExists_code
      });

      if (myresponseChecIMExists_code == 200) {
        var parsedBody = JSON.parse(myresponseChecIMExists_body);
        if (parsedBody.exists == true) {
        } else {
          //Get Contact Details
          if (primaryContactInternalID) {
            var headerObj = {
              name: "Content-Type",
              value: "application/json"
            };
            var responseUserAuth = https.post({
              url: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCEKfFKLTso-t3Lu6YV8XOpCCBF2az9Hcg",
              body: {
                email: imContactEmail,
                password: "123456aA",
                returnSecureToken: true
              },
              headers: headerObj
            });

            //"type":"http.ClientResponse","code":200,"headers":{"Alt-Svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","alt-svc":"h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","cache-control":"no-cache, no-store, max-age=0, must-revalidate","Content-Type":"application/json; charset=UTF-8","content-type":"application/json; charset=UTF-8","Date":"Wed, 17 Jun 2026 01:25:10 GMT","date":"Wed, 17 Jun 2026 01:25:10 GMT","Expires":"Mon, 01 Jan 1990 00:00:00 GMT","expires":"Mon, 01 Jan 1990 00:00:00 GMT","Pragma":"no-cache","pragma":"no-cache","Server":"ESF","server":"ESF","Transfer-Encoding":"chunked","transfer-encoding":"chunked","Vary":"Origin","vary":"Origin","Via":"1.1 mono001","via":"1.1 mono001","X-Content-Type-Options":"nosniff","x-content-type-options":"nosniff","X-Frame-Options":"SAMEORIGIN","x-frame-options":"SAMEORIGIN","X-XSS-Protection":"0","x-xss-protection":"0","X-Xss-Protection":"0"},"body":"{\n \"kind\": \"identitytoolkit#SignupNewUserResponse\",\n \"idToken\": \"eyJhbGciOiJSUzI1NiIsImtpZCI6ImVlOTA0NmVhZDJlMDUwMDAxMGVkNTA0M2I0ODNkODRiMGM1MmM3YzQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbXAtbHBvLWNvbm5lY3QiLCJhdWQiOiJtcC1scG8tY29ubmVjdCIsImF1dGhfdGltZSI6MTc4MTY1OTUxMCwidXNlcl9pZCI6IjNUdmxpQzNxcTZPbXpwbW5aeURtV0NLREVzSTIiLCJzdWIiOiIzVHZsaUMzcXE2T216cG1uWnlEbVdDS0RFc0kyIiwiaWF0IjoxNzgxNjU5NTEwLCJleHAiOjE3ODE2NjMxMTAsImVtYWlsIjoibGlqaW5nZGFsaWFuQGhvdG1haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImxpamluZ2RhbGlhbkBob3RtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.yD3220B8FzFu-438Vum7Rxxx8ddDDDegN5v7YDl0dy7vlxoHVpF2OhhmnE7lqzULxdeEG2AG4ey0qN8M83-DR0sAwNHLeRwjPOpzC1qk18SvAq1M-oX-ipKin4IsVFDXeGr0UPKEnepd8Lc0qJTKW6tK_IjL7Rh-TOXFgOtBRp2kfpmv0Eu9xWokEQQegNITNMl0_9dN9nTPNWyTyB9pImIYF3sfWL3JYlqa0FYBR7RHHsgNS7iPSY0F26Ghp3ArxGqCWzoEmHIsMqxS6tjxRuAJAOjmGOoymMoEMTOcl5ZsliVQczTIRCXbMeKxe-JpeYdSJNTMqbpnea91PKBObg\",\n \"email\": \"lijingdalian@hotmail.com\",\n \"refreshToken\": \"AMf-vBzzlfTVj7RvjXyzfibMRMsdI7oFVMKg5nCTVAN1SS6XWtOeL1R52uj1HjtokxjNpFX9gpaDRG6aorzzGxRmNCDp5cqbKmbkJ-heB-8YGBsKWWP3MRRSvs5M2fSHNcIBzkTR9A6F-H-jLBQ0PMmdjxvHYygM41ByXrG0kalS8wO9jNbALhoWjKpMFzcVceb2OKmij_tFGz0L1C-GK1KHomvelVJlyQ\",\n \"expiresIn\": \"3600\",\n \"localId\": \"3TvliC3qq6OmzpmnZyDmWCKDEsI2\"\n}\n"}

            log.debug({
              title: "responseUserAuth",
              details: responseUserAuth
            });

            log.debug({
              title: "JSON.parse(responseUserAuth.body)",
              details: JSON.parse(responseUserAuth.body)
            });

            var parsedResponseUserAuthBody = JSON.parse(responseUserAuth.body);

            log.debug({
              title: "parsedResponseUserAuthBody.localId",
              details: parsedResponseUserAuthBody.localId
            });

            var authID = parsedResponseUserAuthBody.localId;

            var imContactDetails = '{"fields": {';
            imContactDetails +=
              '"first_name": {"stringValue": "' + imContactFName + '"},';
            imContactDetails +=
              '"last_name": {"stringValue": "' + imContactLName + '"},';
            imContactDetails +=
              '"email": {"stringValue": "' + imContactEmail + '"},';
            imContactDetails +=
              '"phone": {"stringValue": "' + imContactPhone + '"},';
            imContactDetails +=
              '"parent_id": {"stringValue": "' + internalid + '"},';
            imContactDetails +=
              '"companyId": {"stringValue": "' + internalid + '"},';
            imContactDetails +=
              '"customer_id": {"stringValue": "' + internalid + '"},';
            imContactDetails += '"role": {"stringValue": "parent"}}}';

            var urlCreateUser =
              "https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/users?documentId=" +
              authID;

            log.debug({
              title: "urlCreateUser",
              details: urlCreateUser
            });

            var headerObj = {
              name: "Content-Type",
              value: "application/json"
            };

            var responseUser = https.post({
              url: urlCreateUser,
              body: imContactDetails,
              headers: headerObj
            });

            log.debug({
              title: "responseUser",
              details: responseUser
            });

            var myresponseuser_body = responseUser.body;
            var myresponseuser_code = responseUser.code;

            log.debug({
              title: "myresponseuser_body",
              details: myresponseuser_body
            });

            log.debug({
              title: "myresponseuser_code",
              details: myresponseuser_code
            });
          }
        }
      }

      //Load Parent IM Record
      var customer_record = record.load({
        type: record.Type.LEAD,
        id: internalid
      });

      var customerEntityId = customer_record.getValue({
        fieldId: "entityid"
      });
      var imName = customer_record.getValue({
        fieldId: "companyname"
      });
      var imLinkedZeesText = customer_record.getText({
        fieldId: "custentity_im_linked_franchisees"
      });
      var imLinkedZees = customer_record.getValue({
        fieldId: "custentity_im_linked_franchisees"
      });

      //Actual Parent Name: IM - QLD GOV - Parent.
      //Need to strip away IM - and - Parent.
      var imCompanyName = imName;
      if (!isNullorEmpty(imCompanyName)) {
        if (imCompanyName.indexOf("IM - ") === 0) {
          imCompanyName = imCompanyName.substring(5);
        }
        if (imCompanyName.slice(-9) === " - Parent") {
          imCompanyName = imCompanyName.slice(0, -9);
        }
        imCompanyName = imCompanyName.trim();
      }
      imName = imCompanyName;

      log.debug({
        title: "imName",
        details: imName
      });

      if (!isNullorEmpty(imLinkedZees)) {
        imLinkedZees = imLinkedZees.toString();
        log.debug({
          title: "imLinkedZees",
          details: imLinkedZees
        });
        if (imLinkedZees.indexOf(",") != -1) {
          var imLinkedZeesArray = imLinkedZees.split(",");
        } else {
          var imLinkedZeesArray = [];
          imLinkedZeesArray.push(imLinkedZees);
        }
      }
      log.debug({
        title: "imLinkedZeesArray",
        details: imLinkedZeesArray
      });

      //Get the Address of the LPO Customer
      //NetSuite Search: SALESP - Addresses
      var searched_addresses = search.load({
        id: "customsearch_cust_list_site_addresses",
        type: "customer"
      });

      searched_addresses.filters.push(
        search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: internalid
        })
      );

      var address1 = "";
      var address2 = "";
      var suburb = "";
      var state = "";
      var postcode = "";
      var latitude = "";
      var longitude = "";

      searched_addresses.run().each(function (resultSetAddresses) {
        address2 = resultSetAddresses.getValue({
          name: "address1",
          join: "Address"
        });
        address1 = resultSetAddresses.getValue({
          name: "address2",
          join: "Address"
        });
        suburb = resultSetAddresses.getValue({
          name: "city",
          join: "Address"
        });
        state = resultSetAddresses.getText({
          name: "state",
          join: "Address"
        });
        postcode = resultSetAddresses.getValue({
          name: "zipcode",
          join: "Address"
        });
        latitude = resultSetAddresses.getValue({
          name: "custrecord_address_lat",
          join: "Address"
        });
        longitude = resultSetAddresses.getValue({
          name: "custrecord_address_lon",
          join: "Address"
        });
        return true;
      });

      //Load Partner Record to get the AP Suburb Mapping JSON
      var imSuburbMappingJSON = [];
      var activeOperator = [];

      for (var x = 0; x < imLinkedZeesArray.length; x++) {
        var partnerRecord = record.load({
          type: record.Type.PARTNER,
          id: imLinkedZeesArray[x]
        });

        var zeeJSONString = partnerRecord.getValue({
          fieldId: "custentity_ironmountain_suburbs_json"
        });
        var zeeLocation = partnerRecord.getText({
          fieldId: "location"
        });

        if (!isNullorEmpty(zeeJSONString)) {
          var zeeJSON = JSON.parse(zeeJSONString);
          zeeJSON.forEach(function (suburb) {
            if (!isNullorEmpty(suburb.parent_im_id)) {
              if (suburb.parent_im_id == internalid) {
                imSuburbMappingJSON.push(suburb);
                if (!isNullorEmpty(suburb.primary_op)) {
                  if (Array.isArray(suburb.primary_op)) {
                    for (var i = 0; i < suburb.primary_op.length; i++) {
                      activeOperator.push(suburb.primary_op[i]);
                    }
                  } else {
                    activeOperator.push(suburb.primary_op);
                  }
                }
              }
            }
          });
        }
      }

      log.debug({
        title: "activeOperator",
        details: activeOperator
      });

      activeOperator = removeDuplicates(activeOperator);

      //Remove duplicates from imSuburbMappingJSON based on the suburb, state and postcode combination
      imSuburbMappingJSON =
        removeDuplicatesBySuburbStatePostcode(imSuburbMappingJSON);

      log.debug({
        title: "imSuburbMappingJSON",
        details: imSuburbMappingJSON
      });
      log.debug({
        title: "activeOperator",
        details: activeOperator
      });

      var imDetails = '{"fields": {';
      imDetails += '"im_id": {"stringValue": "' + internalid + '"},';
      imDetails += '"name": {"stringValue": "' + imName + '"},';
      imDetails += '"address1": {"stringValue": "' + address2 + '"},';
      imDetails += '"street": {"stringValue": "' + address1 + '"},';
      imDetails += '"city": {"stringValue": "' + suburb + '"},';
      imDetails += '"Location": {"stringValue": "' + suburb + '"},';
      imDetails += '"state": {"stringValue": "' + state + '"},';
      imDetails += '"zip": {"stringValue": "' + postcode + '"},';
      imDetails += '"latitude": {"stringValue": "' + latitude + '"},';
      imDetails += '"longitude": {"stringValue": "' + longitude + '"},';

      imDetails += '"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
      imSuburbMappingJSON.forEach(function (suburb) {
        var stringValue =
          suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
        imDetails += '{"stringValue": "' + stringValue + '"},';
      });
      //remove thee last character if it is a comma
      if (imDetails.slice(-1) == ",") {
        imDetails = imDetails.slice(0, -1);
      }
      imDetails += "]}},";

      //Service Rates
      imDetails += '"imServiceH2HRate": {"stringValue": "10"},';
      imDetails += '"imServiceAMPORate": {"stringValue": "6"},';
      //remove thee last character if it is a comma
      if (imDetails.slice(-1) == ",") {
        imDetails = imDetails.slice(0, -1);
      }
      imDetails += "}}";

      log.debug({
        title: "IM Details",
        details: imDetails
      });

      if (myresponseChecIMExists_code == 200) {
        var parsedBody = JSON.parse(myresponseChecIMExists_body);
        if (parsedBody.exists == true) {
          log.audit({
            title:
              "Lead " +
              internalid +
              " Record Exists > Updating Record in Firebase",
            details: ""
          });

          //Update Lead Record in Firebase
          var firebaseUpdateLeadsURL =
            "https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/companies/" +
            internalid +
            "?updateMask.fieldPaths=im_id&updateMask.fieldPaths=name&updateMask.fieldPaths=address1&updateMask.fieldPaths=street&updateMask.fieldPaths=city&updateMask.fieldPaths=Location&updateMask.fieldPaths=state&updateMask.fieldPaths=zip&updateMask.fieldPaths=latitude&updateMask.fieldPaths=longitude&updateMask.fieldPaths=franchiseeTerritoryJSON&updateMask.fieldPaths=imServiceH2HRate&updateMask.fieldPaths=imServiceAMPORate";

          log.debug({
            title: "firebaseUpdateLeadsURL",
            details: firebaseUpdateLeadsURL
          });

          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["Accept"] = "*/*";
          apiHeaders["X-HTTP-Method-Override"] = "PATCH";

          var response = https.request({
            method: https.Method.POST,
            url: firebaseUpdateLeadsURL,
            body: imDetails,
            headers: apiHeaders
          });

          var myresponse_body = response.body;
          var myresponse_code = response.code;

          log.debug({
            title: "myresponse_body",
            details: myresponse_body
          });

          log.debug({
            title: "myresponse_code",
            details: myresponse_code
          });

          var returnObj = {
            success: true,
            message: "",
            result: "Lead Resynced to Firebase Successfully"
          };

          log.audit({
            title: "Lead " + internalid + " Resynced to Firebase Successfully",
            details: returnObj
          });
        } else {
          log.audit({
            title: "Lead " + internalid + " Record Does Not Exist in Firebase",
            details: "Create Lead in LocalMile Plus Firebase Database"
          });

          var urlCreateLPO =
            "https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/companies?documentId=" +
            internalid;

          log.debug({
            title: "urlCreateLPO",
            details: urlCreateLPO
          });

          var headerObj = {
            name: "Content-Type",
            value: "application/json"
          };

          var responseLPO = https.post({
            url: urlCreateLPO,
            body: imDetails,
            headers: headerObj
          });

          log.debug({
            title: "responseLPO",
            details: responseLPO
          });

          var myresponselpo_body = responseLPO.body;
          var myresponselpo_code = responseLPO.code;

          log.debug({
            title: "myresponselpo_body",
            details: myresponselpo_body
          });

          log.debug({
            title: "myresponselpo_code",
            details: myresponselpo_code
          });

          customer_record.setValue({
            fieldId: "custentity_lpo_synced_with_db",
            value: 1
          });
          linkedParentCustomerInternalID = customer_record.save({
            ignoreMandatoryFields: true
          });
        }
      }

      _sendJSResponse(context.request, context.response, returnObj);
    } else {
    }
  }

  return {
    onRequest: onRequest
  };

  function _sendJSResponse(request, response, respObject) {
    // response.setContentType("JAVASCRIPT");
    // response.setHeader('Access-Control-Allow-Origin', '*');
    var callbackFcn = request.jsoncallback || request.callback;
    if (callbackFcn) {
      response.writeLine({
        output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
      });
    } else response.writeLine({ output: JSON.stringify(respObject) });
  }

  function getSalesRepWithMinCount(salesReps, salesRepCounts) {
    // Find the minimum count among all sales reps
    var minCount = null;
    for (var i = 0; i < salesReps.length; i++) {
      var count = salesRepCounts[salesReps[i]];
      if (minCount === null || count < minCount) {
        minCount = count;
      }
    }
    // Collect all sales reps with the minimum count
    var eligibleSalesReps = [];
    for (var i = 0; i < salesReps.length; i++) {
      if (salesRepCounts[salesReps[i]] === minCount) {
        eligibleSalesReps.push(salesReps[i]);
      }
    }
    return eligibleSalesReps;
  }

  function getDialersWithMinCount(dialers, dialerCounts) {
    // Find the minimum count among all dialers
    var minCount = null;
    for (var i = 0; i < dialers.length; i++) {
      var count = dialerCounts[dialers[i]];
      if (minCount === null || count < minCount) {
        minCount = count;
      }
    }
    // Collect all dialers with the minimum count
    var eligibleDialers = [];
    for (var i = 0; i < dialers.length; i++) {
      if (dialerCounts[dialers[i]] === minCount) {
        eligibleDialers.push(dialers[i]);
      }
    }
    return eligibleDialers;
  }

  function getDateStoreNS() {
    var date = new Date();
    // if (date.getHours() > 6) {
    //     date.setDate(date.getDate() + 1);
    // }

    format.format({
      value: date,
      type: format.Type.DATE,
      timezone: format.Timezone.AUSTRALIA_SYDNEY
    });

    return date;
  }

  // Shuffle dialers for initial randomness
  function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * @description Pads the current string with another string (multiple times, if needed) until the resulting string reaches the given length. The padding is applied from the start (left) of the current string.
   * @param {string} str - The original string to pad.
   * @param {number} targetLength - The length of the resulting string once the current string has been padded.
   * @param {string} padString - The string to pad the current string with. Defaults to a space if not provided.
   * @returns {string} The padded string.
   */
  function customPadStart(str, targetLength, padString) {
    // Convert the input to a string
    str = String(str);

    // If the target length is less than or equal to the string's length, return the original string
    if (str.length >= targetLength) {
      return str;
    }

    // Calculate the length of the padding needed
    var paddingLength = targetLength - str.length;

    // Repeat the padString enough times to cover the padding length
    var repeatedPadString = customRepeat(
      padString,
      Math.ceil(paddingLength / padString.length)
    );

    // Slice the repeated padString to the exact padding length needed and concatenate with the original string
    return repeatedPadString.slice(0, paddingLength) + str;
  }

  /**
   * @description Repeats the given string a specified number of times.
   * @param {string} str - The string to repeat.
   * @param {number} count - The number of times to repeat the string.
   * @returns {string} The repeated string.
   */
  function customRepeat(str, count) {
    // Convert the input to a string
    str = String(str);

    // If the count is 0 or less, return an empty string
    if (count <= 0) {
      return "";
    }

    // Initialize the result string
    var result = "";

    // Repeat the string by concatenating it to the result
    for (var i = 0; i < count; i++) {
      result += str;
    }

    return result;
  }

  function removeDuplicates(arr) {
    var unique = [];
    for (var i = 0; i < arr.length; i++) {
      if (unique.indexOf(arr[i]) === -1) {
        unique.push(arr[i]);
      }
    }
    return unique;
  }

  /**
   * @description Function to check if a service exists in the service list.
   * @author Ankith Ravindran (AR)
   * @date 17/06/2025
   * @param {*} data
   * @param {*} service
   * @returns {*}
   */
  function getServiceRate(serviceList, serviceName) {
    // serviceList: array of objects with 'name' and 'rate' properties
    // serviceName: string to check (case-insensitive)
    for (var i = 0; i < serviceList.length; i++) {
      if (serviceList[i].name == serviceName) {
        return { rate: serviceList[i].rate, id: serviceList[i].id };
      }
    }
    return null; // Not found
  }

  function removeDuplicatesBySuburbStatePostcode(lpoSuburbMappingJSON) {
    var seen = {};
    var result = [];
    for (var i = 0; i < lpoSuburbMappingJSON.length; i++) {
      var item = lpoSuburbMappingJSON[i];
      var key = item.suburbs + "|" + item.state + "|" + item.post_code;
      if (!seen[key]) {
        seen[key] = true;
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Is Null or Empty.
   *
   * @param {Object} strVal
   */
  function isNullorEmpty(strVal) {
    return (
      strVal == null ||
      strVal == "" ||
      strVal == "null" ||
      strVal == undefined ||
      strVal == "undefined" ||
      strVal == "- None -"
    );
  }
});
