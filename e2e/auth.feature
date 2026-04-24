Feature: Authentication
  Users can sign up, sign in, and sign out.

  Scenario: Sign in with existing credentials
    Given a user exists with email "signin-test@foodlab.test" and password "TestPass1!"
    And I am on the sign-in page
    When I fill in "email" with "signin-test@foodlab.test"
    And I fill in "password" with "TestPass1!"
    And I click the "Sign in" button
    Then I should be on the home page

  Scenario: Sign out
    Given I am signed in
    When I click the sign-out button
    Then I should be on the sign-in page
