<a id="_Hlk96424277"></a>Assessment Test

Backend Developer

 

Write a simple application to send a happy birthday message to users on their birthday at exactly 9 am on their local time. For example, if one user is in New York and the second user is in Melbourne, they should be getting a birthday message in their own time zone. 

 

**Requirements** 

·       TypeScript)

·       Simple API to create or delete users only: 

o   POST /user 

o   DELETE /user 

·       User has a first name and last name, birthday date and location (locations could be in any format of your choice). You can add more fields as you see fit to make the system works

·       The system needs to send the following message at 9am on users’ local time via call to[ https://email-service.digitalenvision.com.au](https://hookbin.com/) endpoint (create a new one for yourself): “Hey, {full\_name} it’s your birthday”. API docs can be accessed here <https://email-service.digitalenvision.com.au/api-docs/ >

o   Note that the API is not actually sending emails, but the status code will return normally.

o   Sometimes the API will return random errors, or timeout.

·       The system needs to be able to recover and send all unsent messages if the service was down for a period (say a day). 

·       You may use any database technology you’d like, and you are allowed to take advantage of the database’s internal mechanisms. 

·       You may use 3rd party libs such as express.js, moment.js, ORM etc to save development time. 

 

**Things to consider ** 

·      Make sure your code is scalable and has a good level of abstraction. For example, in the future we may want to add a happy anniversary message as well. 

·      Make sure your code is tested and testable 

·      Be mindful of race conditions, duplicate messages are unacceptable 

·      Think about scalability (with the limits of localhost), will the system be able to handle thousands of birthdays a day? 

 

**Bonus** 

For extra brownie points, add PUT /user for the user to edit their details. Make sure the birthday message will still be delivered on the correct day.

 

Please upload your code to Git and open it for public until during the job application process. Send the link to the recruiter.
