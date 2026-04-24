Feature: Shopping Cart
  The cart shows a consolidated shopping list derived from the plan.

  Scenario: Empty cart when no plan
    Given I am signed in
    And I navigate to "/cart"
    Then I should see an empty state with text "Nothing to shop for"

  Scenario: Cart shows items after plan is filled
    Given I am signed in
    And the plan has at least one recipe
    When I navigate to "/cart"
    Then I should see at least 1 shopping list section
    And I should see at least 1 ingredient item

  Scenario: Tick an item as bought
    Given I am signed in
    And the plan has at least one recipe
    And I navigate to "/cart"
    When I tick the first ingredient checkbox
    Then the first ingredient should show as bought
    And the bought count should increase
