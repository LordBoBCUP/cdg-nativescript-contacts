import { Observable } from "tns-core-modules/data/observable";

import { getJSON } from "tns-core-modules/http";
import { ObservableArray } from "tns-core-modules/data/observable-array";
//import { isAndroid } from "tns-core-modules/platform";

let contactList = new ObservableArray();

export class HelloWorldModel extends Observable {
    private _counter: number;
    private _message: string;
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

    async onTap() {
        console.log("Button was pressed");
        this.updateMessage("Processing...");
        await exports.contacts();
        this.updateMessage("Contacts Successfully Synced.");
    }

    private updateMessage(m: string) {
        this.message = m;
    }
}

exports.contacts = async function() {
    console.log("Here1");
    await getJSON("http://nzakl1pc001.augen.co.nz:8080/contacts").then(
        function(r: any) {
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
    var contactFields = ["name"];
    var phoneContacts = await contacts.getAllContacts(contactFields).then(
        function(args) {
            if (args.data === null) {
                console.log("No Contacts Found.");
            } else {
                console.log("args.data");
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
                console.log(
                    "Adding items to requiredContacts because there are no detected contacts on the phone."
                );
                requiredContacts.push(c);
            }
            break;
        }
        for (var j = 0; j < phoneContacts.length; j++) {
            console.log(
                "phoneContacts: " +
                    phoneContacts[j].name.given +
                    " " +
                    phoneContacts[j].name.family
            );
            console.log("httpObject: " + c[i].firstname + " " + c[i].lastname);
            if (
                phoneContacts[j].name.given == c[i].firstname &&
                phoneContacts[j].name.family == c[i].lastname
            ) {
                console.log("Contact Already exists. Dont process");
                continue;
            } else {
                requiredContacts.push(c);
            }
        }
    }

    console.log(
        "Looping through the requiredContacts array. Length is: " +
            requiredContacts.length
    );
    for (var k = 0; k < requiredContacts.length; k++) {
        console.log(requiredContacts[k]);
        var newContact = new contacts.Contact();
        newContact.name.given = requiredContacts[k].firstname;
        newContact.name.family = requiredContacts[k].lastname;
        newContact.phoneNumbers.push({
            label: contacts.KnownLabel.HOME,
            value: requiredContacts[k].phonenumber
        });
        newContact.name.displayname =
            requiredContacts[k].firstname + " " + requiredContacts[k].lastname;
        try {
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
