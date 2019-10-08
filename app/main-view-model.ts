import { ObservableProperty } from "../app/observable-property-decorator";
import { Observable } from "tns-core-modules/data/observable";
import { BackgroundFetch } from "nativescript-background-fetch";
import { getJSON } from "tns-core-modules/http";
import { ObservableArray } from "tns-core-modules/data/observable-array";
import * as appSettings from "tns-core-modules/application-settings";

let contactList = new ObservableArray();

export class HelloWorldModel extends Observable {
    private _counter: number;
    private _message: string;
    @ObservableProperty() textFieldValue: string = "";

    constructor() {
        super();

        // Initialize default values.
        this._counter = 42;
        this.updateMessage("Ready.");

        // You can query the UIBackgroundRefreshStatus.  User can disable fetch.
        BackgroundFetch.status(status => {
            console.log("- BackgroundFetch status: ", status);
        });

        // Configure Background Fetch
        BackgroundFetch.configure(
            {
                stopOnTerminate: false,
                minimumFetchInterval: 15 // minutes
            },
            () => {
                console.log("[js] BackgroundFetch event received");
                //
                // Do stuff.  You have 30s of background-time.
                //
                // When your job is complete, you must signal completion or iOS can kill your app.  Signal the nature of the fetch-event, whether you recevied:
                // FETCH_RESULT_NEW_DATA: Received new data from your server
                // FETCH_RESULT_NO_DATA:  No new data received from your server
                // FETCH_RESULT_FAILED:  Failed to receive new data.
                exports.contacts(appSettings.getString("secret"));
                BackgroundFetch.finish(BackgroundFetch.FETCH_RESULT_NEW_DATA);
            },
            status => {
                console.log("BackgroundFetch not supported by your OS", status);
            }
        );
    }

    get message(): string {
        return this._message;
    }

    set message(value: string) {
        if (this._message !== value) {
            this._message = value;
            this.notifyPropertyChange("message", value);
        }
    }

    async onTap(args) {
        this.updateMessage("Processing...");
        try {
            await exports.contacts(this.textFieldValue);
            this.updateMessage("Contacts Successfully Synced.");
            await this.sleep(3000);
            this.updateMessage("Ready...");
        } catch (e) {
            console.log(e);
            if (e.message == "Unauthorized") {
                //this.updateMessage("Your PIN is either not valid or expired!");
                this.updateMessage(e.message);
                this.resetMessage();
                return;
            }
        }
    }

    async deleteContacts() {
        this.updateMessage("Processing...");
        this.textFieldValue = "";
        await exports.deleteCDGContacts();
        this.updateMessage("Contacts Successfully Deleted!");
        this.resetMessage();
    }

    private updateMessage(m: string) {
        this.message = m;
    }

    private async resetMessage() {
        await this.sleep(3000);
        this.updateMessage("Ready...");
    }

    sleep(ms: any) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

exports.contacts = async function(pin: any) {
    console.log("PIN Before checking appsettings" + pin);
    if (pin == null) {
        pin = appSettings.getString("secret");
        if (pin == null) {
            console.log("appSettings PIN: " + pin);
            // Not going to be authorized so dont even bother querying the API.
            throw new Error("No PIN provided.");
        }
    }
    console.log("PIN After" + pin);
    await getJSON("http://nzakl1pc001.augen.co.nz:8080/contacts/" + pin).then(
        function(r: any) {
            console.log("Passed PIN: " + pin);
            if (r.Error == "Your PIN is not valid or expired.") {
                console.log("New Error");
                // Remove PIN from local storage
                appSettings.remove("secret");
                throw new Error("Unauthorized");
            }

            // Save PIN for future use
            console.log("Setting secret in appSettings: " + r.Secret);
            appSettings.setString("secret", String(r.Secret));
            console.log(
                "Prove secret is set by getting it: " +
                    appSettings.getString("secret")
            );
            var c = new Array();
            console.log("Array length should be 2: " + r.Contacts.length);
            console.log("array is: " + r);
            for (var i = 0; i < r.Contacts.length; i++) {
                var contact = new Contact(
                    r.Contacts[i].ID,
                    r.Contacts[i].FirstName,
                    r.Contacts[i].LastName,
                    r.Contacts[i].PhoneNumber,
                    r.Contacts[i].Address
                );
                console.log("Contact object is: " + contact);
                c.push(contact);
            }
            try {
                exports.newContact(c);
            } catch (e) {
                console.log(e);
            }
        },
        function(e) {
            console.log(e);
        }
    );
};

exports.newContact = async function(c: any) {
    console.log("Running newContact()");
    var app = require("application");
    var contacts = require("nativescript-contacts");
    // Get Contacts object
    var contactFields = ["name", "organization"];
    var phoneContacts = await contacts.getAllContacts(contactFields).then(
        function(args) {
            if (args.data === null) {
            } else {
                return args.data;
            }
        },
        function(err) {
            console.log("Error: " + err);
        }
    );

    var requiredContacts = new Array();

    for (var i = 0; i < c.length; i++) {
        if (phoneContacts.length == 0) {
            for (var x = 0; x < c.length; x++) {
                requiredContacts.push(c[x]);
            }
            break;
        }
        for (var j = 0; j < phoneContacts.length; j++) {
            if (
                phoneContacts[j].name.given == c[i].firstname &&
                phoneContacts[j].name.family == c[i].lastname &&
                phoneContacts.organization.name == "CDG"
            ) {
                console.log("Contact Already exists. Dont process");
                continue;
            } else {
                requiredContacts.push(c[i]);
            }
        }
    }
    //console.log("REQUIRED CONTACTS COUNT IS: " + requiredContacts.length);

    for (var k = 0; k < requiredContacts.length; k++) {
        var newContact = new contacts.Contact();
        //console.log(requiredContacts[k]);
        newContact.name.given = requiredContacts[k].firstname;
        newContact.name.family = requiredContacts[k].lastname;
        newContact.phoneNumbers.push({
            label: contacts.KnownLabel.HOME,
            value: requiredContacts[k].phonenumber
        });
        newContact.organization.name = "CDG";
        newContact.name.displayname =
            requiredContacts[k].firstname + " " + requiredContacts[k].lastname;
        try {
            //console.log(newContact);
            await newContact.save();
        } catch (e) {
            console.log(e);
        }
    }
};

class Contact {
    id: number;
    firstname: string;
    lastname: string;
    phonenumber: string;
    address: string;

    constructor(id, firstname, lastname, phonenumber, address) {
        this.id = id;
        this.firstname = firstname;
        this.lastname = lastname;
        this.phonenumber = phonenumber;
        this.address = address;
    }
}

exports.deleteCDGContacts = async function() {
    var app = require("application");
    var contacts = require("nativescript-contacts");

    var contactFields = ["name", "organization"];

    await contacts.getAllContacts(contactFields).then(
        function(args) {
            /// Returns args:
            /// args.data: Generic cross platform JSON object, null if no contacts were found.
            /// args.reponse: "fetch"
            if (args.data === null) {
                // Do nothing, no contacts to iterate through
                console.log("args is empty");
                return true;
            }

            for (var i = 0; i < args.data.length; i++) {
                console.log(
                    args.data[i].name.given +
                        " " +
                        args.data[i].organization.name
                );
                if (args.data[i].organization.name == "CDG") {
                    var contact = args.data[i];
                    console.log("Deleting: \n" + contact);
                    contact.delete();
                }
            }
        },
        function(err) {
            console.log("Error: " + err);
        }
    );
};
