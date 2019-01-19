# API List
## Account
<span style="color: #00ff00">__POST /account__</span> 

Search list of user accounts.

Request Body:
```json
{
    "limit"  : 10,
    "offset" : 0,
    "search" : "John"
}
```
- (optional) __limit__ is expected number of account to be returned.
- (optional) __offset__ is starting index of returned account, used for paging.
- (optional) __search__ is keywords to be matched with name, email, and phone.

<span style="color: #00ff00">__POST /account/{user_id}/edit__</span> 

Edit user's profile of specified **{user_id}**.

Request Body:
```json
{
    "current_password"  : 5,
    "password_1"        : "123456",
    "password_2"        : "123456",
    "name"              : "John Doe",
    "email"             : "john.doe@mail.com",
    "phone"             : "08080808080"
}
```
All fields are optional.

<span style="color: #00ff00">__POST /account/create__</span> 

Create new account.

Request Body:
```json
{
    "password_1"        : "123456",
    "password_2"        : "123456",
    "name"              : "John Doe",
    "email"             : "john.doe@mail.com",
    "phone"             : "08080808080"
}
```
__phone__ is optional.

<span style="color: #00ff00">__POST /account/verify__</span> 

Verify pair of email and password. Used for login either with or without Google login.

Request Body:
```json
{
    "email"         : "john.doe@mail.com",
    "password"      : "123456",
    "name"          : "John Doe",
    "phone"         : "08080808080",
    "login_type"    : "google"
}
```
- **email** and **password** is required to verify user's login either with or without google account.
- (optional) **name**, **phone** is used when **login_type** is "google" and user's account has never been created in database.
- **login_type** is required when user is doing login with google account, otherwise it is optional.

## Toko
<span style="color: #00ff00">__POST /toko/get__</span> 

Search list of toko.

Request Body:
```json
{
    "toko_id": 5,
    "limit"  : 10,
    "offset" : 0,
    "search" : "Borma"
}
```
- (optional) __toko_id__ is id of toko which its data is expected to be returned.
- (optional) __limit__ is expected number of toko to be returned.
- (optional) __offset__ is starting index of returned list of toko, used for paging.
- (optional) __search__ is keywords to be matched with name of toko or address of toko.

<span style="color: #00ff00">__POST /toko/create__</span> 

Create new toko.

Request Body:
```json
{
    "name"          : 5,
    "address"       : 10,
    "description"   : "So good",  
    "open_at"       : "07:00",
    "close_at"      : "24:00",
    "latitude"      : 5.21312231,
    "longitude"     : 6.12312312,
    "phone"         : 08080808080,
    "category"      : 1,
    "image"         : "<image_file, use header 'Content-Type': 'multipart/form-data'>"
}
```
All fields are required, except **image** and  **description**.

<span style="color: #00ff00">__POST /toko/{toko_id}/edit__</span> 

Edit data of toko.

Request Body:
```json
{
    "name"          : 5,
    "address"       : 10,
    "description"   : "So good",  
    "open_at"       : "07:00",
    "close_at"      : "24:00",
    "latitude"      : 5.21312231,
    "longitude"     : 6.12312312,
    "phone"         : 08080808080,
    "category"      : 1,
    "image"         : "<image_file, requires header 'Content-Type': 'multipart/form-data'>",
    "img_url"       : "<previous_image's_url>"
}
```
All fields are required, except **description**, **image** and **img_url**. Both **image** and **img_url** is required when changing toko's image.

<span style="color: #00ff00">__POST /toko/{toko_id}/item/create__</span> 

Create new item in toko.

Request Body:
```json
{
    "name"          : "Raket",
    "price"         : 10000,
    "description"   : "So nice",
    "image"         : "<image_file, requires header 'Content-Type': 'multipart/form-data'>"
}
```
Only **name** and **price** are required.

<span style="color: #00ff00">__POST /toko/{toko_id}/item/{item_id}/edit__</span> 

Edit item in toko.

Request Body:
```json
{
    "name"          : "Raket",
    "price"         : 10000,
    "description"   : "So nice",
    "image"         : "<image_file, requires header 'Content-Type': 'multipart/form-data'>",
    "img_url"       : "<previous_image's_url>"
}
```
Only **name** and **price** are required. Both **image** and **img_url** is required when changing toko's image.

<span style="color: #00ff00">__POST /toko/{toko_id}/delete__</span> 

Delete toko.

<span style="color: #00ff00">__POST /toko/{toko_id}*/item/{item_id}/delete__</span> 

Delete item from toko.

<span style="color: #00ff00">__POST /toko/explore__</span> 

Explore nearest toko.

Request Body:
```json
{
    "latitude"  : 1.231231,
    "longitude" : 5.2312312,
    "category"  : 1,
    "low_rad"   : 0,
    "high_rad"  : 1000
}
```
- **latitude** is latitude of current user's position from gps or any other coordinate in maps.
- **longitude** is longitude of current user's position from gps any other coordinate in maps.
- (optional) **category** is category of toko used to filter the result.
- (optional) **low_rad** or "low radius" is lower constraint of search radius.
- (optional) **high_rad** or "high radius" is higher constraint of search radius.

<span style="color: #00ff00">__POST /toko/{toko_id}/item__</span> 

Search list of items in toko specified by {toko_id}.

Request Body:
```json
{
    "item_id": 5,
    "limit"  : 10,
    "offset" : 0,
    "search" : "Raket"
}
```
- (optional) __item_id__ is id of item which its data is expected to be returned.
- (optional) __limit__ is expected number of item to be returned.
- (optional) __offset__ is starting index of returned list of items, used for paging.
- (optional) __search__ is keywords to be matched with name of item.

<span style="color: #00ff00">__POST /toko/toggle-favourite__</span> 

Mark or unmark an item as favourite item.

Request Body:
```json
{
    "user_id"   : 1,
    "item_id"   : 5,
    "is_fav"    : 1,
    "item_count": 2
}
```
- __is_fav__ is either __0__ (false) or __1__ (true) that is indicated whether the item is favourited by the user.
- (optional) __item_count__ is number of item that is favourited by user.

## Payment
<span style="color: #00ff00">__POST /payment/get/{transaction_id}__</span> 

Get information of transaction specified by {transaction_id}.

<span style="color: #00ff00">__POST /payment/{transaction_id}/confirm__</span> 

Confirm a payment transaction as "paid".

<span style="color: #00ff00">__POST /payment/{transaction_id}/delete__</span>

Delete a payment transaction specified by {transaction_id}.

<span style="color: #00ff00">__POST /payment/{transaction_id}/rate__</span>

Give rating in a payment transaction.

Request Body:
```json
{
    "rating"    : 4,
    "comment"   : "Good"
}
```
**rating** is required, but **comment** is not.

<span style="color: #00ff00">__POST /payment/purchase__</span>

Make a purchase.

Request Body:
```json
{
    "user_id"    : 4,
    "estimation_hour"   : 14,
    "estimation_minute" : 30,
    "item_list"         : 
        [
            {
                "toko_id"       : 2,
                "item_id"       : 3,
                "name"          : "Raket",
                "item_quantity" : 5,
                "price_total"   : 20000
            }
        ]
}
```
- **estimation_hour** is part of estimated time of when the user will arrive at toko to take the items.
- **estimation_minute** is part of estimated time. If user will arrive at 14:30, then **estimation_hour** is 14, and **estimation_minute** is 30.
- **item_list** is list of purchased items.

<span style="color: #00ff00">__POST /payment/history__</span>

Get payment history of user.

Request Body:
```json
{
    "user_id"   : 5,
    "status"    : 2,
    "limit"     : 10,
    "offset"    : 0,
    "search"    : "123"
}
```
All fields are optional. **search** will be matched with transaction id. **status** can be 0 (unpaid), 1 (paid), 2 (rated).




