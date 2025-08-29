# Solflare deeplink issues

During our integration of Solana wallets into our native Biq application we discovered some issues affecting [Solflare deeplink protocol](https://docs.solflare.com/solflare/technical/deeplinks).

Our use-case is fairly simple for now, the user can link a Solana wallet to his profile by singing a nonce message. The flow is the following:
1. App calls `connect` endpoint
2. App calls `signMessage` endpoint
3. App calls `disconnect` endpoint (since we don't need further interaction with the wallet at the moment)

For the purpose of connecting, the native app generates a private keypair for encrypting communication between app and wallet that is securely stored on the device (in our case using [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)). In case the app is re-installed or storage is cleared, the keypair is lost and needs to be regenerated.

Our **redirect_link** URLs include 2 extra query parameters `provider` and `requestId` so the url looks something like this: `me.biq.app://solanawallet/onconnect?provider=Solflare&requestId=1234`. Those parameters are required to properly pair the request with the response from the wallet. 

## [Android, iOS] Parts of the redirect_url are lowercased

The server part of the **redirect_link** is always lowercased.

So for example a **redirect_link** with value:

`me.biq.app://solanaWallet/onconnect?provider=Solflare&requestId=1234`

becomes

`me.biq.app://solanawallet/onconnect?provider=Solflare&requestId=1234`

## [Android, iOS] Some error redirects are malformed

For `connect` and `signMessage` (maybe others as well) when there is an error, Solflare just appends the error parameters to the end of the **redirect_link** like so:
`me.biq.app://solanawallet/onconnect?provider=Solflare&requestId=1234?errorCode=some_error_code&errorMessage=some_error_message` (notice the `?` instead of `&`) thus breaking the validity of the url.

## [Android, iOS] Disconnect malformed URL

A succesfull `disconnect` redirect duplicates query params of the redirect_link and appends them with a space at the end of the url:
``me.biq.app://solanawallet/disconnect?provider=Solflare&requestId=1234 provider=Solflare&requestId=1234`

## [Android, iOS] Disconnect does not work

Calling the `disconnect` endpoint does not return an error but does not disconnect the app also. The app still shows in Solflare -> Settings -> Security & Privacy -> Manage Apps and repeated `connect` calls do not prompt the user to allow app connection but instead automatically accepts the connection.

What is expected is that the disconnect call should remove the app from connected apps and a new connection attempt should prompt the user to allow the connection to the app.

## [iOS] Deeplink opens App Store

When using Solflare deeplinks on iOS on my iPhone 6s with iOS 15.8.4 first Solflare app is opened then it opens a browser and then Soflare's App Store page. If you click open from the App Store page it works, but it's annoying. 

## [Android, iOS] Unable to decrypt payload error

Sometimes Solflare responds with `DeeplinkErrorCode.payloadDecryptionFailed` error on requests after successful `connect`. As long as the same app encryption keypair is used requests will always fail.