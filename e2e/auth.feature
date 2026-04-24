Feature: Authentication
  Users can sign up, sign in, and sign out.

  Scenario: Sign up with a new account
    Given I am on the sign-up page
    When I fill in "email" with "newuser@foodlab.test"
    And I fill in "password" with "SecurePass1!"
    And I fill in "displayName" with "New User"
    And I click the "Sign up" button
    Then I should be on the home page
    And I should see "New User" in the header

  Scenario: Sign in with existing credentials
    Given a user exists with email "existing@foodlab.test" and password "TestPass1!"
    And I am on the sign-in page
    When I fill in "email" with "existing@foodlab.test"
    And I fill in "password" with "TestPass1!"
    And I click the "Sign in" button
    Then I should be on the home page

  Scenario: Sign out
    Given I am signed in
    When I click the sign-out button
    Then I should be on the sign-in page
