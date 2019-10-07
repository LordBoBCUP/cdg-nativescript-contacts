import { ObservableProperty } from "../app/observable-property-decorator";
import { Observable } from "tns-core-modules/data/observable";

import { getJSON } from "tns-core-modules/http";
import { ObservableArray } from "tns-core-modules/data/observable-array";
//import { isAndroid } from "tns-core-modules/platform";

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
        await exports.contacts(this.textFieldValue);
        this.updateMessage("Contacts Successfully Synced.");
        await this.sleep(3000);
        this.updateMessage("Ready...");
    }

    async deleteContacts() {
        this.updateMessage("Processing...");
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
    await getJSON("http://nzakl1pc001.augen.co.nz:8080/contacts/" + pin).then(
        function(r: any) {
            console.log(r[0].error);
            console.log("Passed PIN: " + pin);
            if (r[0].error == "Your PIN is not valid or expired.") {
                return;
            }

            var c = new Array();
            for (var i = 0; i < r.length; i++) {
                var contact = new Contact(
                    r[i].ID,
                    r[i].FirstName,
                    r[i].LastName,
                    r[i].PhoneNumber,
                    r[i].Address
                );
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
            console.log(newContact);
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
