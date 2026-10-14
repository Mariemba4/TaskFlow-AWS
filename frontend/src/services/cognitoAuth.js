// Amazon Cognito User Pools integration (SRP flow, matches ALLOW_USER_SRP_AUTH in template.yaml).
// Tokens are managed by amazon-cognito-identity-js and are never logged here.
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js'

function friendlyError(err) {
  switch (err?.code) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'Incorrect email or password.'
    case 'UsernameExistsException':
      return 'An account with this email already exists.'
    case 'InvalidPasswordException':
      return 'Password must be at least 8 characters with upper-case, lower-case and a number.'
    case 'InvalidParameterException':
      return 'Please check the values you entered.'
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return 'The verification code is invalid or has expired.'
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return 'Authentication failed. Please try again.'
  }
}

/** Error carrying a user-facing message and an optional code the UI can react to. */
export class AuthError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export function createCognitoAuth({ userPoolId, clientId }) {
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId })
  const userFor = (email) => new CognitoUser({ Username: email, Pool: pool })

  function currentSession() {
    return new Promise((resolve, reject) => {
      const user = pool.getCurrentUser()
      if (!user) return reject(new AuthError('Not signed in.', 'NoSession'))
      // getSession transparently refreshes expired ID/access tokens using the refresh token.
      user.getSession((err, session) => {
        if (err || !session?.isValid()) reject(new AuthError('Not signed in.', 'NoSession'))
        else resolve({ user, session })
      })
    })
  }

  return {
    mode: 'aws',

    async getCurrentUser() {
      try {
        const { session } = await currentSession()
        return { email: session.getIdToken().payload.email }
      } catch {
        return null
      }
    },

    async getIdToken() {
      const { session } = await currentSession()
      return session.getIdToken().getJwtToken()
    },

    signUp(email, password) {
      return new Promise((resolve, reject) => {
        pool.signUp(email, password, [new CognitoUserAttribute({ Name: 'email', Value: email })], [], (err) =>
          err ? reject(new AuthError(friendlyError(err), err.code)) : resolve(),
        )
      })
    },

    confirmSignUp(email, code) {
      return new Promise((resolve, reject) => {
        userFor(email).confirmRegistration(code, true, (err) =>
          err ? reject(new AuthError(friendlyError(err), err.code)) : resolve(),
        )
      })
    },

    resendCode(email) {
      return new Promise((resolve, reject) => {
        userFor(email).resendConfirmationCode((err) =>
          err ? reject(new AuthError(friendlyError(err), err.code)) : resolve(),
        )
      })
    },

    signIn(email, password) {
      return new Promise((resolve, reject) => {
        userFor(email).authenticateUser(
          new AuthenticationDetails({ Username: email, Password: password }),
          {
            onSuccess: (session) => resolve({ email: session.getIdToken().payload.email }),
            onFailure: (err) =>
              reject(
                err?.code === 'UserNotConfirmedException'
                  ? new AuthError('Please confirm your email first.', 'UserNotConfirmed')
                  : new AuthError(friendlyError(err), err?.code),
              ),
            newPasswordRequired: () =>
              reject(new AuthError('A password change is required. Contact the administrator.', 'NewPasswordRequired')),
          },
        )
      })
    },

    async signOut() {
      pool.getCurrentUser()?.signOut()
    },
  }
}
